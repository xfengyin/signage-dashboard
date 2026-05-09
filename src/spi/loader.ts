import type {
  Plugin,
  PluginLoaderOptions,
  PluginContext,
  PluginMetadata,
  PluginSandbox,
  DiscoveryResult,
} from './plugin';

export class PluginLoader {
  private plugins: Map<string, Plugin> = new Map();
  private contexts: Map<string, PluginContext> = new Map();
  private options: Required<PluginLoaderOptions>;

  constructor(options: PluginLoaderOptions = {}) {
    this.options = {
      pluginDir: options.pluginDir ?? './plugins',
      watchMode: options.watchMode ?? false,
      sandboxEnabled: options.sandboxEnabled ?? true,
      onLoadStart: options.onLoadStart ?? (() => {}),
      onLoadComplete: options.onLoadComplete ?? (() => {}),
      onError: options.onError ?? ((_, e) => console.error(e)),
    };
  }

  async discover(pattern: string = '**/*-plugin.{ts,js}'): Promise<DiscoveryResult> {
    const result: DiscoveryResult = { plugins: [], errors: [] };
    
    try {
      const manifestPaths = await this.findPluginManifests(pattern);
      
      for (const manifestPath of manifestPaths) {
        try {
          const module = await import(manifestPath);
          const metadata = this.extractMetadata(module);
          if (metadata) {
            result.plugins.push(metadata);
          }
        } catch (err) {
          result.errors.push({
            path: manifestPath,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err) {
      result.errors.push({
        path: this.options.pluginDir,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    
    return result;
  }

  private async findPluginManifests(pattern: string): Promise<string[]> {
    return [];
  }

  async load(pluginId: string, entryPoint: string): Promise<Plugin> {
    this.options.onLoadStart(pluginId);

    try {
      const sandbox = this.createSandbox(pluginId);
      const context = this.createContext(pluginId, sandbox);
      
      const module = await this.dynamicImport(entryPoint);
      const plugin = await this.initializePlugin(pluginId, module, context);
      
      this.plugins.set(pluginId, plugin);
      this.contexts.set(pluginId, context);
      
      this.options.onLoadComplete(pluginId, plugin);
      
      return plugin;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.options.onError(pluginId, error);
      throw error;
    }
  }

  async loadWithDependencies(
    pluginId: string,
    entryPoint: string,
    dependencyResolver: (deps: string[]) => Promise<Map<string, Plugin>>
  ): Promise<Plugin> {
    const module = await import(/* @vite-ignore */ entryPoint);
    const metadata = this.extractMetadata(module);
    
    if (metadata?.dependencies?.length) {
      const resolvedDeps = await dependencyResolver(metadata.dependencies);
      for (const [depId, depPlugin] of resolvedDeps) {
        if (!this.plugins.has(depId)) {
          this.plugins.set(depId, depPlugin);
        }
      }
    }

    return this.load(pluginId, entryPoint);
  }

  private async dynamicImport(path: string): Promise<unknown> {
    return import(/* @vite-ignore */ path);
  }

  private createSandbox(pluginId: string): PluginSandbox {
    if (!this.options.sandboxEnabled) {
      return {
        globals: {},
        restrictedModules: [],
      };
    }

    return {
      globals: {
        console: {
          log: () => {},
          warn: () => {},
          error: () => {},
        },
        setTimeout: globalThis.setTimeout,
        setInterval: globalThis.setInterval,
        clearTimeout: globalThis.clearTimeout,
        clearInterval: globalThis.clearInterval,
      },
      restrictedModules: ['fs', 'child_process', 'net', 'http', 'https', 'dns'],
      maxMemoryMB: 128,
    };
  }

  private createContext(pluginId: string, sandbox: PluginSandbox): PluginContext {
    return {
      pluginId,
      sandbox,
      metadata: { name: pluginId, version: '1.0.0' },
    };
  }

  private async initializePlugin(
    pluginId: string,
    module: unknown,
    context: PluginContext
  ): Promise<Plugin> {
    const pluginModule = module as { default?: Plugin; plugin?: Plugin };
    let plugin = pluginModule.default ?? pluginModule.plugin;

    if (!plugin) {
      throw new Error(`Plugin at ${pluginId} does not export a valid plugin`);
    }

    if (plugin.init) {
      await plugin.init(context);
    }

    return plugin;
  }

  private extractMetadata(module: unknown): PluginMetadata | null {
    const mod = module as { default?: { metadata?: PluginMetadata }; metadata?: PluginMetadata };
    const plugin = mod.default ?? mod;
    
    if (plugin?.metadata && typeof plugin.metadata === 'object') {
      return plugin.metadata as PluginMetadata;
    }
    
    return null;
  }

  async unload(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (plugin.unload) {
      await plugin.unload();
    }

    this.plugins.delete(pluginId);
    this.contexts.delete(pluginId);
  }

  async reload(pluginId: string): Promise<Plugin> {
    const oldPlugin = this.plugins.get(pluginId);
    if (!oldPlugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    const entryPoint = oldPlugin.metadata.entryPoint;
    if (!entryPoint) {
      throw new Error(`Plugin ${pluginId} has no entry point`);
    }

    await this.unload(pluginId);
    return this.load(pluginId, entryPoint);
  }

  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  getAllPlugins(): Map<string, Plugin> {
    return new Map(this.plugins);
  }

  hasPlugin(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  getPluginContext(pluginId: string): PluginContext | undefined {
    return this.contexts.get(pluginId);
  }

  async preloadPlugins(plugins: Array<{ id: string; entry: string }>): Promise<void> {
    for (const { id, entry } of plugins) {
      if (!this.hasPlugin(id)) {
        try {
          await this.load(id, entry);
        } catch (err) {
          console.error(`Failed to preload plugin ${id}:`, err);
        }
      }
    }
  }
}
