import type {
  Plugin,
  PluginRegistryOptions,
  PluginMetadata,
  PluginStatus,
  Tool,
  Skill,
  RagAdapter,
} from './plugin';

export class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();
  private tools: Map<string, Tool> = new Map();
  private skills: Map<string, Skill> = new Map();
  private ragAdapters: Map<string, RagAdapter> = new Map();
  private statusMap: Map<string, PluginStatus> = new Map();
  private options: Required<PluginRegistryOptions>;
  private lifecycleListeners: Map<string, Set<() => void>> = new Map();

  constructor(options: PluginRegistryOptions = {}) {
    this.options = {
      autoInit: options.autoInit ?? false,
      strictMode: options.strictMode ?? true,
      allowDuplicates: options.allowDuplicates ?? false,
    };
  }

  async register(plugin: Plugin): Promise<void> {
    const pluginId = plugin.metadata.name;

    if (this.plugins.has(pluginId)) {
      if (this.options.strictMode) {
        throw new Error(`Plugin ${pluginId} is already registered`);
      }
      if (!this.options.allowDuplicates) {
        throw new Error(`Plugin ${pluginId} already exists`);
      }
    }

    this.plugins.set(pluginId, plugin);
    this.statusMap.set(pluginId, 'pending');

    if (this.isToolPlugin(plugin)) {
      this.tools.set(pluginId, plugin as unknown as Tool);
    }
    if (this.isSkillPlugin(plugin)) {
      this.skills.set(pluginId, plugin as unknown as Skill);
    }
    if (this.isRagAdapterPlugin(plugin)) {
      this.ragAdapters.set(pluginId, plugin as unknown as RagAdapter);
    }
  }

  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      if (this.options.strictMode) {
        throw new Error(`Plugin ${pluginId} not found`);
      }
      return;
    }

    await this.unload(pluginId);
    this.plugins.delete(pluginId);
    this.tools.delete(pluginId);
    this.skills.delete(pluginId);
    this.ragAdapters.delete(pluginId);
    this.statusMap.delete(pluginId);
    this.lifecycleListeners.delete(pluginId);
  }

  async init(pluginId: string): Promise<void> {
    const plugin = this.getPlugin(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    this.updateStatus(pluginId, 'loading');

    try {
      if (plugin.init) {
        await plugin.init({
          pluginId,
          metadata: plugin.metadata,
          sandbox: { globals: {}, restrictedModules: [] },
        });
      }
      this.updateStatus(pluginId, 'loaded');
      this.notifyListeners(pluginId);
    } catch (err) {
      this.updateStatus(pluginId, 'error');
      throw err;
    }
  }

  async load(pluginId: string): Promise<void> {
    const plugin = this.getPlugin(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (this.statusMap.get(pluginId) === 'loaded') {
      try {
        if (plugin.load) {
          await plugin.load();
        }
        if (plugin.onActivate) {
          await plugin.onActivate();
        }
        this.updateStatus(pluginId, 'active');
        this.notifyListeners(pluginId);
      } catch (err) {
        this.updateStatus(pluginId, 'error');
        throw err;
      }
    }
  }

  async unload(pluginId: string): Promise<void> {
    const plugin = this.getPlugin(pluginId);
    if (!plugin) {
      return;
    }

    const currentStatus = this.statusMap.get(pluginId);
    if (currentStatus === 'active') {
      try {
        if (plugin.onDeactivate) {
          await plugin.onDeactivate();
        }
        if (plugin.unload) {
          await plugin.unload();
        }
        this.updateStatus(pluginId, 'inactive');
        this.notifyListeners(pluginId);
      } catch (err) {
        this.updateStatus(pluginId, 'error');
        throw err;
      }
    }
  }

  async destroy(pluginId: string): Promise<void> {
    const plugin = this.getPlugin(pluginId);
    if (!plugin) {
      return;
    }

    try {
      if (this.statusMap.get(pluginId) === 'active') {
        await this.unload(pluginId);
      }
      if (plugin.destroy) {
        await plugin.destroy();
      }
      this.updateStatus(pluginId, 'destroyed');
    } catch (err) {
      this.updateStatus(pluginId, 'error');
      throw err;
    }
  }

  private updateStatus(pluginId: string, status: PluginStatus): void {
    this.statusMap.set(pluginId, status);
  }

  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  getPluginStatus(pluginId: string): PluginStatus | undefined {
    return this.statusMap.get(pluginId);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getPluginByName(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  getPluginMetadata(pluginId: string): PluginMetadata | undefined {
    return this.plugins.get(pluginId)?.metadata;
  }

  hasPlugin(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  getSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  getSkill(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  hasSkill(id: string): boolean {
    return this.skills.has(id);
  }

  getRagAdapters(): RagAdapter[] {
    return Array.from(this.ragAdapters.values());
  }

  getRagAdapter(name: string): RagAdapter | undefined {
    return this.ragAdapters.get(name);
  }

  hasRagAdapter(name: string): boolean {
    return this.ragAdapters.has(name);
  }

  findPluginsByTag(tag: string): Plugin[] {
    return this.getAllPlugins().filter(
      (plugin) => plugin.metadata.description?.includes(tag)
    );
  }

  onLifecycle(pluginId: string, callback: () => void): () => void {
    if (!this.lifecycleListeners.has(pluginId)) {
      this.lifecycleListeners.set(pluginId, new Set());
    }
    this.lifecycleListeners.get(pluginId)!.add(callback);

    return () => {
      this.lifecycleListeners.get(pluginId)?.delete(callback);
    };
  }

  private notifyListeners(pluginId: string): void {
    const listeners = this.lifecycleListeners.get(pluginId);
    if (listeners) {
      listeners.forEach((callback) => callback());
    }
  }

  private isToolPlugin(plugin: unknown): boolean {
    return (
      typeof plugin === 'object' &&
      plugin !== null &&
      'execute' in plugin &&
      typeof (plugin as Tool).execute === 'function'
    );
  }

  private isSkillPlugin(plugin: unknown): boolean {
    return (
      typeof plugin === 'object' &&
      plugin !== null &&
      'id' in plugin &&
      'execute' in plugin &&
      typeof (plugin as Skill).execute === 'function'
    );
  }

  private isRagAdapterPlugin(plugin: unknown): boolean {
    return (
      typeof plugin === 'object' &&
      plugin !== null &&
      'search' in plugin &&
      typeof (plugin as RagAdapter).search === 'function'
    );
  }

  async initAll(): Promise<void> {
    const initPromises = Array.from(this.plugins.keys()).map((id) =>
      this.init(id).catch((err) => {
        console.error(`Failed to init plugin ${id}:`, err);
      })
    );
    await Promise.allSettled(initPromises);
  }

  async loadAll(): Promise<void> {
    const loadPromises = Array.from(this.plugins.keys()).map((id) =>
      this.load(id).catch((err) => {
        console.error(`Failed to load plugin ${id}:`, err);
      })
    );
    await Promise.allSettled(loadPromises);
  }

  async destroyAll(): Promise<void> {
    const destroyPromises = Array.from(this.plugins.keys()).map((id) =>
      this.destroy(id).catch((err) => {
        console.error(`Failed to destroy plugin ${id}:`, err);
      })
    );
    await Promise.allSettled(destroyPromises);
    this.plugins.clear();
    this.tools.clear();
    this.skills.clear();
    this.ragAdapters.clear();
    this.statusMap.clear();
  }

  getStats(): {
    total: number;
    tools: number;
    skills: number;
    ragAdapters: number;
    byStatus: Record<PluginStatus, number>;
  } {
    const byStatus: Record<PluginStatus, number> = {
      pending: 0,
      loading: 0,
      loaded: 0,
      active: 0,
      inactive: 0,
      error: 0,
      destroyed: 0,
    };

    this.statusMap.forEach((status) => {
      byStatus[status]++;
    });

    return {
      total: this.plugins.size,
      tools: this.tools.size,
      skills: this.skills.size,
      ragAdapters: this.ragAdapters.size,
      byStatus,
    };
  }
}
