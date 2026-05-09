export {
  type AgentFrameworkConfig,
  type AgentConfig,
  type ModelConfig,
  type ToolConfig,
  type SkillConfig,
  type LoggingConfig,
  type SecurityConfig,
  type RemoteConfigSource,
  type EnvironmentConfig,
  type RetryConfig,
  type RateLimitConfig,
  type MergeStrategy,
  type ConfigValidationError,
  type ConfigChangeEvent,
  type ConfigListener,
} from './schema';

export {
  z,
  ZodType,
  ZodObject,
  ZodRawShape,
  retryConfigSchema,
  rateLimitConfigSchema,
  modelConfigSchema,
  toolConfigSchema,
  skillConfigSchema,
  agentConfigSchema,
  loggingConfigSchema,
  securityConfigSchema,
  environmentConfigSchema,
  remoteConfigSourceSchema,
  frameworkConfigSchema,
  getSchemaForType,
  deepMerge,
  validateConfig,
  createDefaultConfig,
} from './schema';

export {
  type ConfigLoaderOptions,
  type ConfigSource,
  ConfigLoader,
  ConfigurationError,
  createConfigLoader,
} from './loader';

export {
  type RegistryOptions,
  type Namespace,
  type RegistrySnapshot,
  Registry,
  RegistryValidationError,
  createRegistry,
} from './registry';

import { ConfigLoader, createConfigLoader } from './loader';
import { Registry, createRegistry } from './registry';
import { createDefaultConfig, AgentFrameworkConfig } from './schema';

export class ConfigManager {
  private loader: ConfigLoader;
  private registry: Registry;

  constructor(options?: ConstructorParameters<typeof ConfigLoader>[0]) {
    this.loader = createConfigLoader(options);
    this.registry = createRegistry(createDefaultConfig());
  }

  async initialize(): Promise<AgentFrameworkConfig> {
    const config = await this.loader.load();
    this.registry.reset(config);
    return config;
  }

  get registry_(): Registry {
    return this.registry;
  }

  get loader_(): ConfigLoader {
    return this.loader;
  }

  async reload(): Promise<AgentFrameworkConfig> {
    const config = await this.loader.reload();
    this.registry.reset(config);
    return config;
  }

  async loadRemote(url: string, options?: {
    authToken?: string;
    timeout?: number;
  }): Promise<void> {
    const remoteSource = await this.loader.loadRemote(url, options);
    await this.loader.mergeRemote(remoteSource);
    this.registry.update(this.loader.getConfig());
  }
}

export function createConfigManager(
  options?: ConstructorParameters<typeof ConfigLoader>[0]
): ConfigManager {
  return new ConfigManager(options);
}

export { ConfigManager as AgentConfigManager };
