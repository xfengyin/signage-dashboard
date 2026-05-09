import {
  AgentFrameworkConfig,
  ConfigChangeEvent,
  ConfigListener,
  ConfigValidationError,
  deepMerge,
  frameworkConfigSchema,
  validateConfig,
} from './schema';

export interface RegistryOptions {
  enableValidation?: boolean;
  enableChangeEvents?: boolean;
  enableNamespaceIsolation?: boolean;
}

export interface Namespace {
  name: string;
  data: Record<string, unknown>;
  locked: boolean;
  parent?: string;
}

export interface RegistrySnapshot {
  timestamp: number;
  config: AgentFrameworkConfig;
  namespaces: string[];
}

export class Registry {
  private config: AgentFrameworkConfig;
  private namespaces: Map<string, Namespace> = new Map();
  private listeners: Set<ConfigListener> = new Set();
  private validationCache: Map<string, ConfigValidationError[]> = new Map();
  private snapshots: RegistrySnapshot[] = [];
  private maxSnapshots: number = 10;
  
  private readonly options: Required<RegistryOptions>;

  constructor(
    initialConfig: AgentFrameworkConfig,
    options: RegistryOptions = {}
  ) {
    this.options = {
      enableValidation: true,
      enableChangeEvents: true,
      enableNamespaceIsolation: true,
      ...options,
    };
    
    this.config = this.deepClone(initialConfig);
    this.initializeNamespaces();
  }

  private initializeNamespaces(): void {
    this.namespaces.set('root', {
      name: 'root',
      data: this.config as unknown as Record<string, unknown>,
      locked: false,
    });

    this.namespaces.set('agent', {
      name: 'agent',
      data: this.config.agent as unknown as Record<string, unknown>,
      locked: false,
      parent: 'root',
    });

    this.namespaces.set('logging', {
      name: 'logging',
      data: this.config.logging as unknown as Record<string, unknown>,
      locked: false,
      parent: 'root',
    });

    this.namespaces.set('security', {
      name: 'security',
      data: this.config.security as unknown as Record<string, unknown>,
      locked: false,
      parent: 'root',
    });
  }

  get<K extends keyof AgentFrameworkConfig>(
    key: K
  ): AgentFrameworkConfig[K] {
    return this.config[key];
  }

  getPath<T = unknown>(path: string): T | undefined {
    const parts = path.split('.');
    let current: unknown = this.config;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current as T;
  }

  set<K extends keyof AgentFrameworkConfig>(
    key: K,
    value: AgentFrameworkConfig[K],
    namespace?: string
  ): void {
    if (namespace && this.options.enableNamespaceIsolation) {
      this.setInNamespace(namespace, key as unknown as string, value);
    } else {
      const oldValue = this.config[key];
      this.config[key] = value;
      
      this.validateAndNotify(key as unknown as string, oldValue, value);
    }
  }

  setPath(path: string, value: unknown, namespace?: string): void {
    if (namespace && this.options.enableNamespaceIsolation) {
      const ns = this.namespaces.get(namespace);
      if (!ns) {
        throw new Error(`Namespace '${namespace}' not found`);
      }
      this.setInNamespacePath(ns, path, value);
    } else {
      const parts = path.split('.');
      const lastKey = parts.pop();
      
      if (!lastKey) return;

      let current: Record<string, unknown> = this.config as unknown as Record<string, unknown>;
      
      for (const part of parts) {
        if (!(part in current) || typeof current[part] !== 'object') {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }

      const oldValue = current[lastKey];
      current[lastKey] = value;

      this.validateAndNotify(path, oldValue, value);
    }
  }

  private setInNamespace(
    namespace: string,
    key: string,
    value: unknown
  ): void {
    const ns = this.namespaces.get(namespace);
    if (!ns) {
      throw new Error(`Namespace '${namespace}' not found`);
    }
    if (ns.locked) {
      throw new Error(`Namespace '${namespace}' is locked`);
    }

    const oldValue = ns.data[key];
    ns.data[key] = value;

    this.syncToConfig(namespace);
    this.validateAndNotify(`${namespace}.${key}`, oldValue, value);
  }

  private setInNamespacePath(
    namespace: Namespace,
    path: string,
    value: unknown
  ): void {
    const parts = path.split('.');
    const lastKey = parts.pop();
    
    if (!lastKey) return;

    let current: Record<string, unknown> = namespace.data;
    
    for (const part of parts) {
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    const oldValue = current[lastKey];
    current[lastKey] = value;

    this.syncToConfig(namespace.name);
    this.validateAndNotify(`${namespace.name}.${path}`, oldValue, value);
  }

  private syncToConfig(namespace: string): void {
    const ns = this.namespaces.get(namespace);
    if (!ns) return;

    switch (namespace) {
      case 'agent':
        this.config.agent = ns.data as unknown as AgentFrameworkConfig['agent'];
        break;
      case 'logging':
        this.config.logging = ns.data as unknown as AgentFrameworkConfig['logging'];
        break;
      case 'security':
        this.config.security = ns.data as unknown as AgentFrameworkConfig['security'];
        break;
    }
  }

  delete(key: string, namespace?: string): boolean {
    if (namespace && this.options.enableNamespaceIsolation) {
      return this.deleteFromNamespace(namespace, key);
    }

    const parts = key.split('.');
    const lastKey = parts.pop();
    
    if (!lastKey) return false;

    let current: Record<string, unknown> = this.config as unknown as Record<string, unknown>;
    
    for (const part of parts) {
      if (!(part in current) || typeof current[part] !== 'object') {
        return false;
      }
      current = current[part] as Record<string, unknown>;
    }

    if (lastKey in current) {
      const oldValue = current[lastKey];
      delete current[lastKey];
      this.validateAndNotify(key, oldValue, undefined);
      return true;
    }

    return false;
  }

  private deleteFromNamespace(namespace: string, key: string): boolean {
    const ns = this.namespaces.get(namespace);
    if (!ns || ns.locked) {
      return false;
    }

    if (key in ns.data) {
      const oldValue = ns.data[key];
      delete ns.data[key];
      this.syncToConfig(namespace);
      this.validateAndNotify(`${namespace}.${key}`, oldValue, undefined);
      return true;
    }

    return false;
  }

  has(path: string, namespace?: string): boolean {
    if (namespace && this.options.enableNamespaceIsolation) {
      const ns = this.namespaces.get(namespace);
      if (!ns) return false;
      return path in ns.data;
    }

    return this.getPath(path) !== undefined;
  }

  createNamespace(
    name: string,
    data?: Record<string, unknown>,
    parent?: string
  ): void {
    if (this.namespaces.has(name)) {
      throw new Error(`Namespace '${name}' already exists`);
    }

    if (parent && !this.namespaces.has(parent)) {
      throw new Error(`Parent namespace '${parent}' not found`);
    }

    this.namespaces.set(name, {
      name,
      data: data || {},
      locked: false,
      parent,
    });
  }

  deleteNamespace(name: string): boolean {
    if (name === 'root') {
      throw new Error('Cannot delete root namespace');
    }

    const ns = this.namespaces.get(name);
    if (!ns) {
      return false;
    }

    if (ns.locked) {
      throw new Error(`Namespace '${name}' is locked`);
    }

    return this.namespaces.delete(name);
  }

  lockNamespace(name: string): void {
    const ns = this.namespaces.get(name);
    if (!ns) {
      throw new Error(`Namespace '${name}' not found`);
    }
    ns.locked = true;
  }

  unlockNamespace(name: string): void {
    const ns = this.namespaces.get(name);
    if (!ns) {
      throw new Error(`Namespace '${name}' not found`);
    }
    ns.locked = false;
  }

  getNamespace(name: string): Namespace | undefined {
    return this.namespaces.get(name);
  }

  listNamespaces(): string[] {
    return Array.from(this.namespaces.keys());
  }

  update(
    updates: Partial<AgentFrameworkConfig>,
    strategy: 'deep' | 'shallow' | 'replace' = 'deep'
  ): void {
    const oldConfig = this.deepClone(this.config);
    
    switch (strategy) {
      case 'deep':
        this.config = deepMerge(this.config, updates);
        break;
      case 'shallow':
        this.config = { ...this.config, ...updates };
        break;
      case 'replace':
        this.config = updates as AgentFrameworkConfig;
        break;
    }

    this.initializeNamespaces();

    if (this.options.enableValidation) {
      const errors = validateConfig(frameworkConfigSchema, this.config);
      if (errors.length > 0) {
        this.config = oldConfig;
        throw new RegistryValidationError('Config validation failed', errors);
      }
    }

    if (this.options.enableChangeEvents) {
      this.notifyListeners({
        namespace: 'root',
        key: '*',
        oldValue: oldConfig,
        newValue: this.config,
        timestamp: Date.now(),
      });
    }
  }

  validate(): ConfigValidationError[] {
    if (!this.options.enableValidation) {
      return [];
    }
    return validateConfig(frameworkConfigSchema, this.config);
  }

  isValid(): boolean {
    return this.validate().length === 0;
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

  private validateAndNotify(
    key: string,
    oldValue: unknown,
    newValue: unknown
  ): void {
    if (this.options.enableValidation) {
      const errors = this.validate();
      if (errors.length > 0) {
        console.warn('Config validation warnings:', errors);
      }
    }

    if (this.options.enableChangeEvents) {
      this.notifyListeners({
        namespace: 'root',
        key,
        oldValue,
        newValue,
        timestamp: Date.now(),
      });
    }
  }

  snapshot(): RegistrySnapshot {
    const snapshot: RegistrySnapshot = {
      timestamp: Date.now(),
      config: this.deepClone(this.config),
      namespaces: this.listNamespaces(),
    };

    this.snapshots.push(snapshot);

    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  restore(snapshot: RegistrySnapshot): void {
    const oldConfig = this.config;
    
    this.config = this.deepClone(snapshot.config);
    this.initializeNamespaces();

    if (this.options.enableChangeEvents) {
      this.notifyListeners({
        namespace: 'root',
        key: '*',
        oldValue: oldConfig,
        newValue: this.config,
        timestamp: Date.now(),
      });
    }
  }

  getSnapshots(): RegistrySnapshot[] {
    return [...this.snapshots];
  }

  export(): AgentFrameworkConfig {
    return this.deepClone(this.config);
  }

  clone(): Registry {
    return new Registry(this.deepClone(this.config), this.options);
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  reset(config: AgentFrameworkConfig): void {
    const oldConfig = this.config;
    this.config = this.deepClone(config);
    this.initializeNamespaces();

    if (this.options.enableChangeEvents) {
      this.notifyListeners({
        namespace: 'root',
        key: '*',
        oldValue: oldConfig,
        newValue: this.config,
        timestamp: Date.now(),
      });
    }
  }
}

export class RegistryValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: ConfigValidationError[]
  ) {
    super(message);
    this.name = 'RegistryValidationError';
  }
}

export function createRegistry(
  config: AgentFrameworkConfig,
  options?: RegistryOptions
): Registry {
  return new Registry(config, options);
}
