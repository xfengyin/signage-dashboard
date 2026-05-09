import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  AgentFrameworkConfig,
  ConfigValidationError,
  ConfigChangeEvent,
  ConfigListener,
  createDefaultConfig,
  deepMerge,
  frameworkConfigSchema,
  validateConfig,
  MergeStrategy,
} from './schema';

export interface ConfigLoaderOptions {
  configDir?: string;
  defaultConfigPath?: string;
  envPrefix?: string;
  enableHotReload?: boolean;
  hotReloadIntervalMs?: number;
}

export interface ConfigSource {
  type: 'defaults' | 'file' | 'env' | 'cli' | 'remote';
  priority: number;
  data: Record<string, unknown>;
}

export class ConfigLoader {
  private config: AgentFrameworkConfig;
  private sources: Map<string, ConfigSource> = new Map();
  private listeners: Set<ConfigListener> = new Set();
  private hotReloadInterval?: NodeJS.Timeout;
  private fileWatchers: Map<string, fs.FSWatcher> = new Map();
  private isLoading = false;
  private lastModified: Map<string, number> = new Map();

  constructor(private options: ConfigLoaderOptions = {}) {
    this.options = {
      configDir: './config',
      defaultConfigPath: './config/defaults.yaml',
      envPrefix: 'AGENT_',
      enableHotReload: false,
      hotReloadIntervalMs: 30000,
      ...options,
    };
    this.config = createDefaultConfig();
  }

  async load(): Promise<AgentFrameworkConfig> {
    if (this.isLoading) {
      throw new Error('Config loading is already in progress');
    }
    
    this.isLoading = true;
    
    try {
      this.sources.clear();
      
      const defaultsSource = await this.loadDefaults();
      this.sources.set('defaults', defaultsSource);
      this.config = deepMerge(this.config, defaultsSource.data as Partial<AgentFrameworkConfig>);
      
      const fileSource = await this.loadFromFile();
      if (fileSource) {
        this.sources.set('file', fileSource);
        this.config = deepMerge(this.config, fileSource.data as Partial<AgentFrameworkConfig>);
      }
      
      const envSource = this.loadFromEnv();
      if (Object.keys(envSource.data).length > 0) {
        this.sources.set('env', envSource);
        this.config = deepMerge(this.config, envSource.data as Partial<AgentFrameworkConfig>);
      }
      
      const errors = validateConfig(frameworkConfigSchema, this.config);
      if (errors.length > 0) {
        throw new ConfigurationError('Config validation failed', errors);
      }
      
      if (this.options.enableHotReload) {
        this.startHotReload();
      }
      
      return this.config;
    } finally {
      this.isLoading = false;
    }
  }

  private async loadDefaults(): Promise<ConfigSource> {
    const defaultConfigPath = this.options.defaultConfigPath;
    
    if (defaultConfigPath && fs.existsSync(defaultConfigPath)) {
      const content = await this.readFile(defaultConfigPath);
      const parsed = this.parseConfig(content, defaultConfigPath);
      return {
        type: 'defaults',
        priority: 0,
        data: parsed as Record<string, unknown>,
      };
    }
    
    return {
      type: 'defaults',
      priority: 0,
      data: createDefaultConfig() as unknown as Record<string, unknown>,
    };
  }

  private async loadFromFile(): Promise<ConfigSource | null> {
    const configDir = this.options.configDir || './config';
    
    if (!fs.existsSync(configDir)) {
      return null;
    }

    const configFiles = [
      path.join(configDir, 'config.yaml'),
      path.join(configDir, 'config.yml'),
      path.join(configDir, 'config.json'),
    ];

    let mergedData: Record<string, unknown> = {};

    for (const configFile of configFiles) {
      if (fs.existsSync(configFile)) {
        const content = await this.readFile(configFile);
        const parsed = this.parseConfig(content, configFile);
        mergedData = deepMerge(mergedData, parsed);
        this.lastModified.set(configFile, fs.statSync(configFile).mtimeMs);
      }
    }

    if (Object.keys(mergedData).length === 0) {
      return null;
    }

    return {
      type: 'file',
      priority: 1,
      data: mergedData,
    };
  }

  private loadFromEnv(): ConfigSource {
    const data: Record<string, unknown> = {};
    const envPrefix = this.options.envPrefix || 'AGENT_';
    
    for (const key of Object.keys(process.env)) {
      if (key.startsWith(envPrefix)) {
        const configKey = key
          .slice(envPrefix.length)
          .toLowerCase()
          .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        
        const value = process.env[key];
        
        try {
          data[configKey] = JSON.parse(value as string);
        } catch {
          data[configKey] = value;
        }
      }
    }
    
    if (Object.keys(data).length === 0) {
      return { type: 'env', priority: -1, data: {} };
    }

    return {
      type: 'env',
      priority: 2,
      data: this.convertEnvToConfig(data),
    };
  }

  private convertEnvToConfig(envData: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(envData)) {
      const parts = key.split('.');
      let current = result;
      
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const nextPart = parts[i + 1];
        
        if (!(part in current)) {
          current[part] = {};
        }
        
        if (/^\d+$/.test(nextPart)) {
          if (!Array.isArray(current[part])) {
            current[part] = [];
          }
          current = (current[part] as unknown[])[parseInt(nextPart, 10)] as Record<string, unknown>;
          if (!current) {
            current = {};
            (current[part] as unknown[])[parseInt(nextPart, 10)] = current;
          }
        } else {
          current = current[part] as Record<string, unknown>;
        }
      }
      
      const lastPart = parts[parts.length - 1];
      current[lastPart] = value;
    }
    
    return result;
  }

  private parseConfig(content: string, filePath: string): Record<string, unknown> {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.yaml':
      case '.yml':
        return yaml.load(content) as Record<string, unknown>;
      case '.json':
        return JSON.parse(content);
      default:
        try {
          return yaml.load(content) as Record<string, unknown>;
        } catch {
          return JSON.parse(content);
        }
    }
  }

  private async readFile(filePath: string): Promise<string> {
    return fs.promises.readFile(filePath, 'utf-8');
  }

  async loadRemote(url: string, options?: {
    authToken?: string;
    timeout?: number;
  }): Promise<ConfigSource> {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        ...(options?.authToken && { 'Authorization': `Bearer ${options.authToken}` }),
      },
      signal: options?.timeout 
        ? AbortSignal.timeout(options.timeout) 
        : undefined,
    });

    if (!response.ok) {
      throw new Error(`Failed to load remote config: ${response.statusText}`);
    }

    const data = await response.json() as Record<string, unknown>;

    return {
      type: 'remote',
      priority: 3,
      data,
    };
  }

  async mergeRemote(remoteSource: ConfigSource): Promise<void> {
    const oldConfig = { ...this.config };
    this.sources.set('remote', remoteSource);
    this.config = deepMerge(this.config, remoteSource.data as Partial<AgentFrameworkConfig>);
    
    const errors = validateConfig(frameworkConfigSchema, this.config);
    if (errors.length > 0) {
      this.sources.delete('remote');
      this.config = oldConfig;
      throw new ConfigurationError('Remote config validation failed', errors);
    }

    this.notifyListeners({
      namespace: 'remote',
      key: '*',
      oldValue: oldConfig,
      newValue: this.config,
      timestamp: Date.now(),
    });
  }

  async reload(): Promise<AgentFrameworkConfig> {
    this.stopHotReload();
    this.stopFileWatchers();
    
    for (const [name, source] of this.sources) {
      if (source.type === 'file') {
        this.sources.delete(name);
      }
    }
    
    return this.load();
  }

  private startHotReload(): void {
    if (this.hotReloadInterval) {
      return;
    }

    const configDir = this.options.configDir;
    if (!configDir) return;

    this.watchDirectory(configDir);

    this.hotReloadInterval = setInterval(async () => {
      await this.checkForChanges();
    }, this.options.hotReloadIntervalMs);
  }

  private stopHotReload(): void {
    if (this.hotReloadInterval) {
      clearInterval(this.hotReloadInterval);
      this.hotReloadInterval = undefined;
    }
  }

  private stopFileWatchers(): void {
    for (const watcher of this.fileWatchers.values()) {
      watcher.close();
    }
    this.fileWatchers.clear();
  }

  private watchDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) return;

    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        this.watchDirectory(fullPath);
      } else if (file.match(/\.(yaml|yml|json)$/)) {
        this.watchFile(fullPath);
      }
    }
  }

  private watchFile(filePath: string): void {
    if (this.fileWatchers.has(filePath)) return;

    try {
      const watcher = fs.watch(filePath, async (eventType) => {
        if (eventType === 'change') {
          await this.onFileChange(filePath);
        }
      });
      this.fileWatchers.set(filePath, watcher);
    } catch (error) {
      console.warn(`Failed to watch file: ${filePath}`, error);
    }
  }

  private async onFileChange(filePath: string): Promise<void> {
    try {
      const stat = await fs.promises.stat(filePath);
      const lastMtime = this.lastModified.get(filePath) || 0;

      if (stat.mtimeMs > lastMtime) {
        this.lastModified.set(filePath, stat.mtimeMs);
        await this.reload();
        
        this.notifyListeners({
          namespace: 'file',
          key: filePath,
          oldValue: null,
          newValue: this.config,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error(`Failed to reload config after file change: ${filePath}`, error);
    }
  }

  private async checkForChanges(): Promise<void> {
    const configDir = this.options.configDir;
    if (!configDir || !fs.existsSync(configDir)) return;

    const configFiles = [
      path.join(configDir, 'config.yaml'),
      path.join(configDir, 'config.yml'),
      path.join(configDir, 'config.json'),
    ];

    for (const configFile of configFiles) {
      if (fs.existsSync(configFile)) {
        const stat = fs.statSync(configFile);
        const lastMtime = this.lastModified.get(configFile);

        if (!lastMtime || stat.mtimeMs > lastMtime) {
          await this.reload();
          break;
        }
      }
    }
  }

  addListener(listener: ConfigListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  removeListener(listener: ConfigListener): void {
    this.listeners.delete(listener);
  }

  private notifyListeners(event: ConfigChangeEvent): void {
    for (const listener of this.listeners) {
      try {
        const result = listener(event);
        if (result instanceof Promise) {
          result.catch((error) => {
            console.error('Listener error:', error);
          });
        }
      } catch (error) {
        console.error('Listener error:', error);
      }
    }
  }

  getConfig(): AgentFrameworkConfig {
    return this.config;
  }

  getSource(type: string): ConfigSource | undefined {
    return this.sources.get(type);
  }

  getAllSources(): ConfigSource[] {
    return Array.from(this.sources.values()).sort((a, b) => a.priority - b.priority);
  }

  updateConfig(updates: Partial<AgentFrameworkConfig>, source: ConfigSource['type'] = 'cli'): void {
    const oldConfig = { ...this.config };
    this.sources.set(source, {
      type: source,
      priority: 99,
      data: updates as Record<string, unknown>,
    });
    this.config = deepMerge(this.config, updates);
    
    this.notifyListeners({
      namespace: source,
      key: '*',
      oldValue: oldConfig,
      newValue: this.config,
      timestamp: Date.now(),
    });
  }
}

export class ConfigurationError extends Error {
  constructor(
    message: string,
    public readonly errors: ConfigValidationError[]
  ) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export function createConfigLoader(options?: ConfigLoaderOptions): ConfigLoader {
  return new ConfigLoader(options);
}
