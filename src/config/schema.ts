import { z, ZodType, ZodObject, ZodRawShape } from 'zod';

export interface ModelConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'azure' | 'custom';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  timeout?: number;
  retryConfig?: RetryConfig;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface ToolConfig {
  name: string;
  description?: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  rateLimit?: RateLimitConfig;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  queueSize?: number;
}

export interface SkillConfig {
  name: string;
  description?: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  dependencies?: string[];
}

export interface AgentConfig {
  name: string;
  description?: string;
  version: string;
  defaultModel: string;
  models: Record<string, ModelConfig>;
  tools: Record<string, ToolConfig>;
  skills: Record<string, SkillConfig>;
  maxConcurrentTasks: number;
  taskTimeoutMs: number;
  enableHistory: boolean;
  maxHistoryLength: number;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text' | 'pretty';
  output: 'console' | 'file' | 'stdout';
  filePath?: string;
  maxFileSize?: number;
  maxFiles?: number;
  redactPatterns?: string[];
}

export interface SecurityConfig {
  apiKeyHeader?: string;
  allowedOrigins?: string[];
  allowedIPs?: string[];
  rateLimitEnabled: boolean;
  rateLimit?: RateLimitConfig;
}

export interface RemoteConfigSource {
  url: string;
  authToken?: string;
  pollIntervalMs?: number;
  timeout?: number;
  retryConfig?: RetryConfig;
}

export interface EnvironmentConfig {
  name: 'development' | 'staging' | 'production' | 'test';
  debug: boolean;
}

export interface AgentFrameworkConfig {
  agent: AgentConfig;
  logging: LoggingConfig;
  security: SecurityConfig;
  environments: Record<string, EnvironmentConfig>;
  remote?: RemoteConfigSource;
}

export type MergeStrategy = 'deep' | 'shallow' | 'replace';

export interface ConfigValidationError {
  path: string;
  message: string;
  value?: unknown;
}

export interface ConfigChangeEvent {
  namespace: string;
  key: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
}

export type ConfigListener = (event: ConfigChangeEvent) => void | Promise<void>;

const retryConfigSchema: ZodObject<ZodRawShape> = z.object({
  maxRetries: z.number().min(0).max(10).default(3),
  initialDelayMs: z.number().min(0).default(1000),
  maxDelayMs: z.number().min(0).default(30000),
  backoffMultiplier: z.number().min(1).default(2),
});

const rateLimitConfigSchema: ZodObject<ZodRawShape> = z.object({
  maxRequests: z.number().min(1).default(100),
  windowMs: z.number().min(1000).default(60000),
  queueSize: z.number().min(0).optional(),
});

const modelConfigSchema: ZodObject<ZodRawShape> = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'azure', 'custom']),
  model: z.string().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  timeout: z.number().min(1000).optional(),
  retryConfig: retryConfigSchema.optional(),
});

const toolConfigSchema: ZodObject<ZodRawShape> = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  config: z.record(z.unknown()).optional(),
  rateLimit: rateLimitConfigSchema.optional(),
});

const skillConfigSchema: ZodObject<ZodRawShape> = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  config: z.record(z.unknown()).optional(),
  dependencies: z.array(z.string()).optional(),
});

const agentConfigSchema: ZodObject<ZodRawShape> = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.string().default('1.0.0'),
  defaultModel: z.string().default('gpt-4'),
  models: z.record(z.string(), modelConfigSchema),
  tools: z.record(z.string(), toolConfigSchema),
  skills: z.record(z.string(), skillConfigSchema),
  maxConcurrentTasks: z.number().min(1).default(10),
  taskTimeoutMs: z.number().min(1000).default(300000),
  enableHistory: z.boolean().default(true),
  maxHistoryLength: z.number().min(1).default(100),
});

const loggingConfigSchema: ZodObject<ZodRawShape> = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  format: z.enum(['json', 'text', 'pretty']).default('json'),
  output: z.enum(['console', 'file', 'stdout']).default('stdout'),
  filePath: z.string().optional(),
  maxFileSize: z.number().optional(),
  maxFiles: z.number().optional(),
  redactPatterns: z.array(z.string()).optional(),
});

const securityConfigSchema: ZodObject<ZodRawShape> = z.object({
  apiKeyHeader: z.string().optional(),
  allowedOrigins: z.array(z.string()).optional(),
  allowedIPs: z.array(z.string()).optional(),
  rateLimitEnabled: z.boolean().default(true),
  rateLimit: rateLimitConfigSchema.optional(),
});

const environmentConfigSchema: ZodObject<ZodRawShape> = z.object({
  name: z.enum(['development', 'staging', 'production', 'test']),
  debug: z.boolean().default(false),
});

const remoteConfigSourceSchema: ZodObject<ZodRawShape> = z.object({
  url: z.string().url(),
  authToken: z.string().optional(),
  pollIntervalMs: z.number().min(5000).optional(),
  timeout: z.number().min(1000).optional(),
  retryConfig: retryConfigSchema.optional(),
});

export const frameworkConfigSchema: ZodObject<ZodRawShape> = z.object({
  agent: agentConfigSchema,
  logging: loggingConfigSchema,
  security: securityConfigSchema,
  environments: z.record(z.string(), environmentConfigSchema),
  remote: remoteConfigSourceSchema.optional(),
});

export function getSchemaForType(type: keyof AgentFrameworkConfig): ZodType {
  const schemaMap: Record<string, ZodType> = {
    agent: agentConfigSchema,
    logging: loggingConfigSchema,
    security: securityConfigSchema,
    remote: remoteConfigSourceSchema,
  };
  return schemaMap[type] || z.unknown();
}

export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>,
  strategy: MergeStrategy = 'deep'
): T {
  const result = { ...target } as T;

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (strategy === 'replace' || sourceValue === undefined) {
      if (sourceValue !== undefined) {
        (result as Record<string, unknown>)[key] = sourceValue;
      }
    } else if (strategy === 'deep' && 
               isPlainObject(targetValue) && 
               isPlainObject(sourceValue)) {
      (result as Record<string, unknown>)[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
        strategy
      );
    } else if (sourceValue !== undefined) {
      (result as Record<string, unknown>)[key] = sourceValue;
    }
  }

  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateConfig<T>(
  schema: ZodType<T>,
  config: unknown,
  path = ''
): ConfigValidationError[] {
  const errors: ConfigValidationError[] = [];

  const result = schema.safeParse(config);
  
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push({
        path: path ? `${path}.${issue.path.join('.')}` : issue.path.join('.'),
        message: issue.message,
        value: config,
      });
    }
  }

  return errors;
}

export function createDefaultConfig(): AgentFrameworkConfig {
  return {
    agent: {
      name: 'default-agent',
      version: '1.0.0',
      defaultModel: 'gpt-4',
      models: {
        'gpt-4': {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 4096,
        },
      },
      tools: {},
      skills: {},
      maxConcurrentTasks: 10,
      taskTimeoutMs: 300000,
      enableHistory: true,
      maxHistoryLength: 100,
    },
    logging: {
      level: 'info',
      format: 'json',
      output: 'stdout',
    },
    security: {
      rateLimitEnabled: true,
      rateLimit: {
        maxRequests: 100,
        windowMs: 60000,
      },
    },
    environments: {
      development: {
        name: 'development',
        debug: true,
      },
      production: {
        name: 'production',
        debug: false,
      },
    },
  };
}

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
};
