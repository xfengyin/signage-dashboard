/**
 * @fileOverview 状态常量 - 企业级Agent框架的状态代码和状态消息定义
 * @module constants/status
 * @description 定义执行状态、Agent状态、工具状态等各种运行时状态常量
 */

/**
 * 执行状态枚举
 * 表示Agent执行过程中的主要状态
 */
export const EXECUTION_STATUS = {
  PENDING: 'pending',
  INITIALIZING: 'initializing',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout',
  ABORTED: 'aborted',
} as const;

/**
 * 执行阶段枚举
 * 表示Agent执行过程中的具体阶段
 */
export const EXECUTION_PHASES = {
  INITIALIZATION: 'init',
  PARSING: 'parsing',
  PLANNING: 'planning',
  TOOL_SELECTION: 'tool_selection',
  TOOL_VALIDATION: 'tool_validation',
  EXECUTION: 'execution',
  RESULT_PROCESSING: 'result_processing',
  EVALUATION: 'evaluation',
  FINALIZATION: 'finalizing',
  COMPLETED: 'done',
  ERROR: 'error',
} as const;

/**
 * 工具调用状态枚举
 */
export const TOOL_CALL_STATUS = {
  PENDING: 'pending',
  VALIDATING: 'validating',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout',
  RETRYING: 'retrying',
} as const;

/**
 * Agent状态枚举
 */
export const AGENT_STATUS = {
  IDLE: 'idle',
  INITIALIZING: 'initializing',
  READY: 'ready',
  RUNNING: 'running',
  PAUSED: 'paused',
  STOPPING: 'stopping',
  STOPPED: 'stopped',
  ERROR: 'error',
  DISPOSED: 'disposed',
} as const;

/**
 * 会话状态枚举
 */
export const SESSION_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
  EXPIRED: 'expired',
  DELETED: 'deleted',
} as const;

/**
 * 消息角色枚举
 */
export const MESSAGE_ROLE = {
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT: 'assistant',
  TOOL: 'tool',
  FUNCTION: 'function',
} as const;

/**
 * 消息内容类型枚举
 */
export const CONTENT_TYPE = {
  TEXT: 'text',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
  FILE: 'file',
  TOOL_USE: 'tool_use',
  TOOL_RESULT: 'tool_result',
  FUNCTION_CALL: 'function_call',
  FUNCTION_RESULT: 'function_result',
} as const;

/**
 * 工具选择策略枚举
 */
export const TOOL_SELECTION_STRATEGY = {
  AUTO: 'auto',
  REQUIRED: 'required',
  NONE: 'none',
  SPECIFIC: 'specific',
} as const;

/**
 * 断路器状态枚举
 */
export const CIRCUIT_BREAKER_STATE = {
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'half_open',
  FORCED_OPEN: 'forced_open',
  DISABLED: 'disabled',
} as const;

/**
 * 限流策略枚举
 */
export const RATE_LIMIT_STRATEGY = {
  FIXED_WINDOW: 'fixed_window',
  SLIDING_WINDOW: 'sliding_window',
  TOKEN_BUCKET: 'token_bucket',
  LEAK_BUCKET: 'leak_bucket',
  CONCURRENCY: 'concurrency',
} as const;

/**
 * 退避策略枚举
 */
export const BACKOFF_STRATEGY = {
  LINEAR: 'linear',
  EXPONENTIAL: 'exponential',
  FIXED: 'fixed',
  FIBONACCI: 'fibonacci',
  FIBONACCI_JITTER: 'fibonacci_jitter',
  EXPONENTIAL_JITTER: 'exponential_jitter',
} as const;

/**
 * 日志级别枚举
 */
export const LOG_LEVEL = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5,
  OFF: 6,
} as const;

/**
 * 健康检查状态枚举
 */
export const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
  UNKNOWN: 'unknown',
} as const;

/**
 * 生命周期状态枚举
 */
export const LIFECYCLE_STATE = {
  INITIAL: 'initial',
  INITIALIZING: 'initializing',
  READY: 'ready',
  STARTING: 'starting',
  STARTED: 'started',
  STOPPING: 'stopping',
  STOPPED: 'stopped',
  DISPOSING: 'disposing',
  DISPOSED: 'disposed',
  ERROR: 'error',
} as const;

/**
 * 技能匹配状态枚举
 */
export const SKILL_MATCH_STATUS = {
  MATCHED: 'matched',
  PARTIAL: 'partial',
  NOT_MATCHED: 'not_matched',
  REQUIRES_MORE_INFO: 'requires_more_info',
} as const;

/**
 * 观察者事件类型枚举
 */
export const OBSERVER_EVENT_TYPE = {
  EXECUTION_START: 'execution:start',
  EXECUTION_END: 'execution:end',
  EXECUTION_ERROR: 'execution:error',
  EXECUTION_CANCEL: 'execution:cancel',
  EXECUTION_TIMEOUT: 'execution:timeout',
  STEP_START: 'step:start',
  STEP_END: 'step:end',
  STEP_ERROR: 'step:error',
  TOOL_CALL: 'tool:call',
  TOOL_RESULT: 'tool:result',
  TOOL_ERROR: 'tool:error',
  TOOL_RETRY: 'tool:retry',
  MESSAGE_CREATE: 'message:create',
  MESSAGE_UPDATE: 'message:update',
  MESSAGE_DELETE: 'message:delete',
  TOKEN_USAGE: 'token:usage',
  RATE_LIMIT: 'rate:limit',
  CIRCUIT_BREAKER_OPEN: 'circuit_breaker:open',
  CIRCUIT_BREAKER_CLOSE: 'circuit_breaker:close',
  RETRY_ATTEMPT: 'retry:attempt',
  RETRY_SUCCESS: 'retry:success',
  RETRY_EXHAUSTED: 'retry:exhausted',
  HEALTH_CHECK: 'health_check',
  METRICS_UPDATE: 'metrics:update',
} as const;

/**
 * 模型类型枚举
 */
export const MODEL_TYPE = {
  CHAT: 'chat',
  COMPLETION: 'completion',
  EMBEDDING: 'embedding',
  MULTIMODAL: 'multimodal',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
} as const;

/**
 * 模型供应商枚举
 */
export const MODEL_PROVIDER = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
  AZURE: 'azure',
  AWS: 'aws',
  ANTHROPIC_CLAUDE: 'anthropic_claude',
  LOCAL: 'local',
  CUSTOM: 'custom',
} as const;

/**
 * 存储类型枚举
 */
export const STORAGE_TYPE = {
  MEMORY: 'memory',
  REDIS: 'redis',
  MEMCACHED: 'memcached',
  DATABASE: 'database',
  FILE: 'file',
  S3: 's3',
  CUSTOM: 'custom',
} as const;

/**
 * 缓存策略枚举
 */
export const CACHE_STRATEGY = {
  LRU: 'lru',
  LFU: 'lfu',
  FIFO: 'fifo',
  TTL: 'ttl',
  WRITE_THROUGH: 'write_through',
  WRITE_BACK: 'write_back',
  NO_CACHE: 'no_cache',
} as const;

/**
 * 中间件类型枚举
 */
export const MIDDLEWARE_TYPE = {
  LOGGER: 'logger',
  METRICS: 'metrics',
  SECURITY: 'security',
  CACHE: 'cache',
  RATE_LIMIT: 'rate_limit',
  AUTH: 'auth',
  VALIDATION: 'validation',
  TRANSFORM: 'transform',
  ERROR_HANDLER: 'error_handler',
  CUSTOM: 'custom',
} as const;

/**
 * 插件类型枚举
 */
export const PLUGIN_TYPE = {
  TOOL: 'tool',
  SKILL: 'skill',
  MODEL: 'model',
  OBSERVER: 'observer',
  MIDDLEWARE: 'middleware',
  STORAGE: 'storage',
  TRANSFORMER: 'transformer',
  VALIDATOR: 'validator',
  CUSTOM: 'custom',
} as const;

/**
 * 错误严重级别枚举
 */
export const ERROR_SEVERITY_LEVEL = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
} as const;

/**
 * 追踪采样决策枚举
 */
export const SAMPLING_DECISION = {
  YES: 'yes',
  NO: 'no',
  DEFERRED: 'deferred',
} as const;

/**
 * 内容过滤原因枚举
 */
export const CONTENT_FILTER_REASON = {
  NONE: 'none',
  HARASSMENT: 'harassment',
  HATE_SPEECH: 'hate_speech',
  SEXUAL: 'sexual',
  VIOLENCE: 'violence',
  SELF_HARM: 'self_harm',
  ERROR: 'error',
} as const;

/**
 * 停止生成原因枚举
 */
export const STOP_REASON = {
  STOP: 'stop',
  LENGTH: 'length',
  CONTENT_FILTER: 'content_filter',
  TOOL_CALLS: 'tool_calls',
  FUNCTION_CALL: 'function_call',
  ERROR: 'error',
} as const;

/**
 * 状态组合类型定义
 */
export type ExecutionStatusValue = typeof EXECUTION_STATUS[keyof typeof EXECUTION_STATUS];
export type ExecutionPhaseValue = typeof EXECUTION_PHASES[keyof typeof EXECUTION_PHASES];
export type ToolCallStatusValue = typeof TOOL_CALL_STATUS[keyof typeof TOOL_CALL_STATUS];
export type AgentStatusValue = typeof AGENT_STATUS[keyof typeof AGENT_STATUS];
export type SessionStatusValue = typeof SESSION_STATUS[keyof typeof SESSION_STATUS];
export type MessageRoleValue = typeof MESSAGE_ROLE[keyof typeof MESSAGE_ROLE];
export type ContentTypeValue = typeof CONTENT_TYPE[keyof typeof CONTENT_TYPE];
export type ToolSelectionStrategyValue = typeof TOOL_SELECTION_STRATEGY[keyof typeof TOOL_SELECTION_STRATEGY];
export type CircuitBreakerStateValue = typeof CIRCUIT_BREAKER_STATE[keyof typeof CIRCUIT_BREAKER_STATE];
export type RateLimitStrategyValue = typeof RATE_LIMIT_STRATEGY[keyof typeof RATE_LIMIT_STRATEGY];
export type BackoffStrategyValue = typeof BACKOFF_STRATEGY[keyof typeof BACKOFF_STRATEGY];
export type LogLevelValue = typeof LOG_LEVEL[keyof typeof LOG_LEVEL];
export type HealthStatusValue = typeof HEALTH_STATUS[keyof typeof HEALTH_STATUS];
export type LifecycleStateValue = typeof LIFECYCLE_STATE[keyof typeof LIFECYCLE_STATE];
export type SkillMatchStatusValue = typeof SKILL_MATCH_STATUS[keyof typeof SKILL_MATCH_STATUS];
export type ObserverEventTypeValue = typeof OBSERVER_EVENT_TYPE[keyof typeof OBSERVER_EVENT_TYPE];
export type ModelTypeValue = typeof MODEL_TYPE[keyof typeof MODEL_TYPE];
export type ModelProviderValue = typeof MODEL_PROVIDER[keyof typeof MODEL_PROVIDER];
export type StorageTypeValue = typeof STORAGE_TYPE[keyof typeof STORAGE_TYPE];
export type CacheStrategyValue = typeof CACHE_STRATEGY[keyof typeof CACHE_STRATEGY];
export type MiddlewareTypeValue = typeof MIDDLEWARE_TYPE[keyof typeof MIDDLEWARE_TYPE];
export type PluginTypeValue = typeof PLUGIN_TYPE[keyof typeof PLUGIN_TYPE];
export type ErrorSeverityLevelValue = typeof ERROR_SEVERITY_LEVEL[keyof typeof ERROR_SEVERITY_LEVEL];
export type SamplingDecisionValue = typeof SAMPLING_DECISION[keyof typeof SAMPLING_DECISION];
export type ContentFilterReasonValue = typeof CONTENT_FILTER_REASON[keyof typeof CONTENT_FILTER_REASON];
export type StopReasonValue = typeof STOP_REASON[keyof typeof STOP_REASON];

/**
 * 状态消息模板
 */
export const STATUS_MESSAGES = {
  [EXECUTION_STATUS.PENDING]: '等待执行',
  [EXECUTION_STATUS.INITIALIZING]: '正在初始化',
  [EXECUTION_STATUS.RUNNING]: '正在执行',
  [EXECUTION_STATUS.PAUSED]: '已暂停',
  [EXECUTION_STATUS.COMPLETED]: '执行完成',
  [EXECUTION_STATUS.FAILED]: '执行失败',
  [EXECUTION_STATUS.CANCELLED]: '执行已取消',
  [EXECUTION_STATUS.TIMEOUT]: '执行超时',
  [EXECUTION_STATUS.ABORTED]: '执行已终止',
  [AGENT_STATUS.IDLE]: 'Agent空闲',
  [AGENT_STATUS.INITIALIZING]: 'Agent初始化中',
  [AGENT_STATUS.READY]: 'Agent就绪',
  [AGENT_STATUS.RUNNING]: 'Agent运行中',
  [AGENT_STATUS.PAUSED]: 'Agent已暂停',
  [AGENT_STATUS.STOPPING]: 'Agent停止中',
  [AGENT_STATUS.STOPPED]: 'Agent已停止',
  [AGENT_STATUS.ERROR]: 'Agent错误',
  [AGENT_STATUS.DISPOSED]: 'Agent已销毁',
  [HEALTH_STATUS.HEALTHY]: '健康',
  [HEALTH_STATUS.DEGRADED]: '性能下降',
  [HEALTH_STATUS.UNHEALTHY]: '不健康',
  [HEALTH_STATUS.UNKNOWN]: '状态未知',
} as const;
