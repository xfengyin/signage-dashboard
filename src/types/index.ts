/**
 * @fileOverview 类型导出 - 企业级Agent框架的统一类型系统
 * @module types
 * @description 提供完整的类型定义导出，包括核心类型、消息类型、执行类型、配置类型等
 */

export * from '../core/types';

export type {
  Role,
  ContentType,
  Content,
  TextContent,
  ImageContent,
  AudioContent,
  VideoContent,
  FileContent,
  ToolUseContent,
  ToolResultContent,
  MessageMetadata,
  Message,
  ToolCallStatus,
  ToolCall,
  ToolResult,
  TokenUsage,
  ExecutionStatus,
  ExecutionPhase,
  ExecutionContext,
  ExecutionResult,
  AgentConfig,
  RetryConfig,
  RateLimitConfig,
  ModelConfig,
  ToolConfig,
  SkillConfig,
  SessionConfig,
  SessionState,
  ObserverEventType,
  ObserverEvent,
  ValidationResult,
  HealthCheckResult,
} from '../core/types';

export type {
  Tool,
  Model,
  ModelResponse,
  StreamChunk,
  EmbeddingResult,
  ModelProvider,
  Skill,
  SkillResult,
  Agent,
  ExecutionPlan,
  PlanStep,
  AgentState,
  Context,
  Result,
  RecordMetadata,
  Config,
  Factory,
  Middleware,
  Observer,
  Storage,
  ToolCaller,
  Planner,
  RetryStrategy,
  RateLimiter,
  RateLimitInfo,
} from '../core/interfaces';

export interface AgentFrameworkTypes {
  Message: Message;
  ExecutionContext: ExecutionContext;
  ExecutionResult: ExecutionResult;
  ToolCall: ToolCall;
  ToolResult: ToolResult;
  ModelResponse: ModelResponse;
  SkillResult: SkillResult;
}

export type Primitive = string | number | boolean | null | undefined;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type AsyncFunction<T = unknown, A extends unknown[] = unknown[]> = (
  ...args: A
) => Promise<T>;

export type SyncFunction<T = unknown, A extends unknown[] = unknown[]> = (
  ...args: A
) => T;

export type Constructor<T = unknown> = new (...args: unknown[]) => T;

export type AsyncConstructor<T = unknown> = new (
  ...args: unknown[]
) => Promise<T>;

export interface KeyValuePair {
  key: string;
  value: unknown;
}

export interface Timestamp {
  timestamp: number;
  date: Date;
}

export interface Duration {
  startTime: number;
  endTime?: number;
  duration?: number;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total?: number;
  hasMore?: boolean;
}

export interface Filter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith';
  value: unknown;
}

export interface Sort {
  field: string;
  order: 'asc' | 'desc';
}

export interface QueryOptions {
  filters?: Filter[];
  sorts?: Sort[];
  pagination?: Pagination;
}

export interface BatchResult<T> {
  successful: T[];
  failed: Array<{ item: T; error: Error }>;
  total: number;
  successCount: number;
  failureCount: number;
}

export type EventHandler<T = unknown> = (event: T) => void | Promise<void>;

export interface EventEmitter {
  on<T = unknown>(event: string, handler: EventHandler<T>): void;
  off<T = unknown>(event: string, handler: EventHandler<T>): void;
  emit<T = unknown>(event: string, data: T): void;
  once<T = unknown>(event: string, handler: EventHandler<T>): void;
  removeAllListeners(event?: string): void;
}

export interface Disposable {
  dispose(): void | Promise<void>;
}

export interface Initializable {
  initialize(): void | Promise<void>;
}

export interface Cleanupable {
  cleanup(): void | Promise<void>;
}

export type LifecycleState = 'initial' | 'initializing' | 'ready' | 'disposing' | 'disposed';

export interface Lifecycle extends Initializable, Cleanupable {
  state: LifecycleState;
  isReady(): boolean;
  isDisposed(): boolean;
}

export interface Validator<T = unknown> {
  validate(value: T): boolean | Promise<boolean>;
  getErrors?(): string[];
}

export interface Serializer<T = unknown> {
  serialize(value: T): string | Promise<string>;
  deserialize(data: string): T | Promise<T>;
}

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  expiresAt?: number;
  createdAt: number;
  accessCount: number;
  lastAccessedAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoff?: 'linear' | 'exponential' | 'fixed';
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

export interface CircuitBreakerState {
  name: string;
  state: 'closed' | 'open' | 'halfOpen';
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
}

export interface HealthStatus {
  healthy: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, boolean>;
  details?: Record<string, unknown>;
  timestamp: number;
}

export interface PerformanceMetrics {
  duration: number;
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage?: {
    user: number;
    system: number;
  };
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  samplingDecision?: 'yes' | 'no' | 'deferred';
  baggage?: Record<string, string>;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
  error?: Error;
  trace?: TraceContext;
}

export interface SecurityContext {
  userId?: string;
  sessionId?: string;
  roles?: string[];
  permissions?: string[];
  ipAddress?: string;
  userAgent?: string;
}

export interface RequestMetadata {
  requestId: string;
  timestamp: number;
  source?: string;
  destination?: string;
  protocol?: string;
  metadata?: Record<string, unknown>;
}

export interface ErrorDetails {
  code: string;
  message: string;
  stack?: string;
  cause?: Error;
  context?: Record<string, unknown>;
  timestamp: number;
  recoverable: boolean;
}

export interface WarningDetails {
  code: string;
  message: string;
  context?: Record<string, unknown>;
  timestamp: number;
}

export interface DeprecationInfo {
  deprecated: true;
  deprecatedAt: string;
  willBeRemovedAt?: string;
  replacement?: string;
  message?: string;
}
