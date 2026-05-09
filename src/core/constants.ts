/**
 * @fileOverview 常量定义 - 企业级Agent框架的核心常量
 * @module core/constants
 */

/**
 * 默认超时时间配置（毫秒）
 */
export const DEFAULT_TIMEOUTS = {
  /** 默认请求超时时间 */
  REQUEST: 60000,
  
  /** 默认单步执行超时 */
  STEP: 30000,
  
  /** 默认工具执行超时 */
  TOOL: 30000,
  
  /** 默认模型响应超时 */
  MODEL: 120000,
  
  /** 默认连接超时 */
  CONNECT: 10000,
  
  /** 默认读取超时 */
  READ: 60000,
  
  /** 默认写入超时 */
  WRITE: 30000,
  
  /** 默认保持连接超时 */
  KEEPALIVE: 5000,
} as const;

/**
 * 默认重试次数配置
 */
export const DEFAULT_RETRY = {
  /** 最大重试次数 */
  MAX_RETRIES: 3,
  
  /** 网络错误最大重试次数 */
  MAX_NETWORK_RETRIES: 5,
  
  /** 工具执行最大重试次数 */
  MAX_TOOL_RETRIES: 2,
  
  /** 模型调用最大重试次数 */
  MAX_MODEL_RETRIES: 3,
  
  /** 速率限制重试次数 */
  RATE_LIMIT_RETRIES: 5,
} as const;

/**
 * 默认延迟配置（毫秒）
 */
export const DEFAULT_DELAYS = {
  /** 初始重试延迟 */
  INITIAL_DELAY: 1000,
  
  /** 最小延迟 */
  MIN_DELAY: 100,
  
  /** 最大延迟 */
  MAX_DELAY: 30000,
  
  /** 默认延迟 */
  DEFAULT_DELAY: 1000,
  
  /** 重连延迟 */
  RECONNECT_DELAY: 2000,
  
  /** 轮询间隔 */
  POLLING_INTERVAL: 1000,
} as const;

/**
 * 令牌限制配置
 */
export const TOKEN_LIMITS = {
  /** 默认最大Token数 */
  DEFAULT_MAX_TOKENS: 4096,
  
  /** 最大输入Token数 */
  MAX_INPUT_TOKENS: 128000,
  
  /** 最大输出Token数 */
  MAX_OUTPUT_TOKENS: 16384,
  
  /** 默认上下文窗口 */
  DEFAULT_CONTEXT_WINDOW: 8192,
  
  /** 安全边距（百分比） */
  SAFETY_MARGIN_PERCENT: 0.9,
  
  /** Token估算：平均每个Token对应的字符数 */
  CHARS_PER_TOKEN: 4,
  
  /** Token估算：英文单词数对应的Token数 */
  WORDS_PER_TOKEN: 0.75,
} as const;

/**
 * 模型参数默认值
 */
export const MODEL_DEFAULTS = {
  /** 默认Temperature */
  TEMPERATURE: 0.7,
  
  /** 默认Top-p */
  TOP_P: 1.0,
  
  /** 默认Top-k */
  TOP_K: 40,
  
  /** 默认频率惩罚 */
  FREQUENCY_PENALTY: 0.0,
  
  /** 默认存在惩罚 */
  PRESENCE_PENALTY: 0.0,
  
  /** 最小Temperature */
  MIN_TEMPERATURE: 0.0,
  
  /** 最大Temperature */
  MAX_TEMPERATURE: 2.0,
  
  /** 默认采样数量 */
  NUM_SAMPLES: 1,
} as const;

/**
 * 执行限制配置
 */
export const EXECUTION_LIMITS = {
  /** 最大执行步数 */
  MAX_STEPS: 100,
  
  /** 默认最大步数 */
  DEFAULT_MAX_STEPS: 50,
  
  /** 最大工具并行数 */
  MAX_PARALLEL_TOOLS: 10,
  
  /** 默认并行数 */
  DEFAULT_PARALLEL_TOOLS: 3,
  
  /** 最大嵌套深度 */
  MAX_NESTING_DEPTH: 10,
  
  /** 最大消息长度 */
  MAX_MESSAGE_LENGTH: 100000,
  
  /** 最大工具参数大小（字节） */
  MAX_TOOL_PARAMS_SIZE: 1000000,
  
  /** 最大历史消息数 */
  MAX_HISTORY_MESSAGES: 1000,
} as const;

/**
 * 消息大小限制
 */
export const MESSAGE_LIMITS = {
  /** 系统消息最大长度 */
  MAX_SYSTEM_MESSAGE_LENGTH: 32000,
  
  /** 用户消息最大长度 */
  MAX_USER_MESSAGE_LENGTH: 64000,
  
  /** 助手消息最大长度 */
  MAX_ASSISTANT_MESSAGE_LENGTH: 64000,
  
  /** 单条消息最大Token */
  MAX_MESSAGE_TOKENS: 32000,
} as const;

/**
 * 速率限制默认值
 */
export const RATE_LIMITS = {
  /** 默认请求窗口（毫秒） */
  DEFAULT_WINDOW_MS: 60000,
  
  /** 默认最大请求数/窗口 */
  DEFAULT_MAX_REQUESTS: 60,
  
  /** 默认最大Token数/窗口 */
  DEFAULT_MAX_TOKENS: 90000,
  
  /** 速率限制头部名称 */
  HEADER_LIMIT: 'X-RateLimit-Limit',
  
  /** 速率限制剩余头部名称 */
  HEADER_REMAINING: 'X-RateLimit-Remaining',
  
  /** 速率限制重置头部名称 */
  HEADER_RESET: 'X-RateLimit-Reset',
} as const;

/**
 * 缓冲区配置
 */
export const BUFFER_CONFIG = {
  /** 流式输出缓冲区大小 */
  STREAM_BUFFER_SIZE: 1024,
  
  /** 写入缓冲区大小 */
  WRITE_BUFFER_SIZE: 65536,
  
  /** 读取缓冲区大小 */
  READ_BUFFER_SIZE: 65536,
  
  /** 最大流式块大小 */
  MAX_CHUNK_SIZE: 4096,
} as const;

/**
 * 缓存配置
 */
export const CACHE_CONFIG = {
  /** 默认TTL（秒） */
  DEFAULT_TTL: 300,
  
  /** 最大TTL（秒） */
  MAX_TTL: 86400,
  
  /** 清理间隔（毫秒） */
  CLEANUP_INTERVAL: 60000,
  
  /** 最大缓存条目数 */
  MAX_CACHE_ENTRIES: 1000,
  
  /** 缓存键前缀 */
  KEY_PREFIX: 'agent:',
} as const;

/**
 * 队列配置
 */
export const QUEUE_CONFIG = {
  /** 默认队列大小 */
  DEFAULT_QUEUE_SIZE: 100,
  
  /** 最大队列大小 */
  MAX_QUEUE_SIZE: 10000,
  
  /** 默认处理并发数 */
  DEFAULT_CONCURRENCY: 5,
  
  /** 最大处理并发数 */
  MAX_CONCURRENCY: 50,
  
  /** 队列满时的等待时间（毫秒） */
  QUEUE_FULL_WAIT: 5000,
} as const;

/**
 * 日志级别
 */
export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
} as const;

/**
 * HTTP状态码
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

/**
 * 错误代码前缀
 */
export const ERROR_PREFIX = {
  /** 通用错误 */
  GENERAL: 'ERR_',
  
  /** 模型相关错误 */
  MODEL: 'ERR_MODEL_',
  
  /** 工具相关错误 */
  TOOL: 'ERR_TOOL_',
  
  /** 执行相关错误 */
  EXECUTION: 'ERR_EXEC_',
  
  /** 认证相关错误 */
  AUTH: 'ERR_AUTH_',
  
  /** 限流相关错误 */
  RATE_LIMIT: 'ERR_RATE_',
  
  /** 超时相关错误 */
  TIMEOUT: 'ERR_TIMEOUT_',
  
  /** 验证相关错误 */
  VALIDATION: 'ERR_VALIDATION_',
} as const;

/**
 * 错误代码
 */
export const ERROR_CODES = {
  /** 模型未找到 */
  MODEL_NOT_FOUND: `${ERROR_PREFIX.MODEL}001`,
  
  /** 模型调用失败 */
  MODEL_INVOCATION_FAILED: `${ERROR_PREFIX.MODEL}002`,
  
  /** 模型响应格式错误 */
  MODEL_RESPONSE_FORMAT_ERROR: `${ERROR_PREFIX.MODEL}003`,
  
  /** 工具未找到 */
  TOOL_NOT_FOUND: `${ERROR_PREFIX.TOOL}001`,
  
  /** 工具执行失败 */
  TOOL_EXECUTION_FAILED: `${ERROR_PREFIX.TOOL}002`,
  
  /** 工具参数验证失败 */
  TOOL_VALIDATION_FAILED: `${ERROR_PREFIX.TOOL}003`,
  
  /** 工具超时 */
  TOOL_TIMEOUT: `${ERROR_PREFIX.TOOL}004`,
  
  /** 执行超时 */
  EXECUTION_TIMEOUT: `${ERROR_PREFIX.EXECUTION}001`,
  
  /** 执行被取消 */
  EXECUTION_CANCELLED: `${ERROR_PREFIX.EXECUTION}002`,
  
  /** 执行步数超限 */
  EXECUTION_STEPS_EXCEEDED: `${ERROR_PREFIX.EXECUTION}003`,
  
  /** 无限循环检测 */
  INFINITE_LOOP_DETECTED: `${ERROR_PREFIX.EXECUTION}004`,
  
  /** 认证失败 */
  AUTH_FAILED: `${ERROR_PREFIX.AUTH}001`,
  
  /** 认证令牌过期 */
  AUTH_TOKEN_EXPIRED: `${ERROR_PREFIX.AUTH}002`,
  
  /** 速率限制 */
  RATE_LIMIT_EXCEEDED: `${ERROR_PREFIX.RATE_LIMIT}001`,
  
  /** 令牌限制 */
  TOKEN_LIMIT_EXCEEDED: `${ERROR_PREFIX.RATE_LIMIT}002`,
} as const;

/**
 * 执行阶段
 */
export const EXECUTION_PHASES = {
  INITIALIZATION: 'init',
  PARSING: 'parsing',
  PLANNING: 'planning',
  TOOL_SELECTION: 'tool_selection',
  EXECUTION: 'execution',
  EVALUATION: 'evaluation',
  FINALIZATION: 'finalizing',
  COMPLETED: 'done',
} as const;

/**
 * 执行状态
 */
export const EXECUTION_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout',
} as const;

/**
 * 消息角色
 */
export const MESSAGE_ROLES = {
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT: 'assistant',
  TOOL: 'tool',
  FUNCTION: 'function',
} as const;

/**
 * 内容类型
 */
export const CONTENT_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
  FILE: 'file',
  TOOL_USE: 'tool_use',
  TOOL_RESULT: 'tool_result',
} as const;

/**
 * 模型类型
 */
export const MODEL_TYPES = {
  CHAT: 'chat',
  COMPLETION: 'completion',
  EMBEDDING: 'embedding',
  MULTIMODAL: 'multimodal',
} as const;

/**
 * 模型供应商
 */
export const MODEL_PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
  AZURE: 'azure',
  LOCAL: 'local',
  CUSTOM: 'custom',
} as const;

/**
 * 停止原因
 */
export const STOP_REASONS = {
  STOP: 'stop',
  LENGTH: 'length',
  CONTENT_FILTER: 'content_filter',
  ERROR: 'error',
} as const;

/**
 * 退避策略
 */
export const BACKOFF_STRATEGIES = {
  LINEAR: 'linear',
  EXPONENTIAL: 'exponential',
  FIXED: 'fixed',
} as const;

/**
 * 工具选择策略
 */
export const TOOL_CHOICE_STRATEGIES = {
  AUTO: 'auto',
  REQUIRED: 'required',
  NONE: 'none',
} as const;

/**
 * 版本信息
 */
export const VERSION = {
  /** 框架主版本号 */
  MAJOR: 1,
  
  /** 框架次版本号 */
  MINOR: 0,
  
  /** 框架补丁版本号 */
  PATCH: 0,
  
  /** 预发布标识 */
  PRERELEASE: 'alpha',
  
  /** 构建元数据 */
  BUILD: process.env.BUILD_HASH || 'development',
  
  /** 版本字符串 */
  get FULL(): string {
    const base = `${this.MAJOR}.${this.MINOR}.${this.PATCH}`;
    return this.PRERELEASE ? `${base}-${this.PRERELEASE}` : base;
  },
} as const;

/**
 * API端点
 */
export const API_ENDPOINTS = {
  CHAT: '/chat/completions',
  COMPLETIONS: '/completions',
  EMBEDDINGS: '/embeddings',
  MODELS: '/models',
  FINE_TUNING: '/fine_tuning',
} as const;

/**
 * 默认HTTP头
 */
export const DEFAULT_HEADERS = {
  CONTENT_TYPE: 'application/json',
  ACCEPT: 'application/json',
  USER_AGENT: `AgentFramework/${VERSION.FULL}`,
} as const;

/**
 * 框架配置键名
 */
export const CONFIG_KEYS = {
  MODEL: 'model',
  TOOLS: 'tools',
  SKILLS: 'skills',
  TIMEOUT: 'timeout',
  RETRY: 'retry',
  RATE_LIMIT: 'rateLimit',
  CACHE: 'cache',
  LOGGING: 'logging',
  OBSERVABILITY: 'observability',
} as const;

/**
 * 上下文变量键名
 */
export const CONTEXT_KEYS = {
  REQUEST_ID: 'requestId',
  USER_ID: 'userId',
  SESSION_ID: 'sessionId',
  TRACE_ID: 'traceId',
  SPAN_ID: 'spanId',
  PARENT_SPAN_ID: 'parentSpanId',
  USER_MESSAGE: 'userMessage',
  SYSTEM_PROMPT: 'systemPrompt',
  TOOL_RESULTS: 'toolResults',
  ITERATION: 'iteration',
  STEP_INDEX: 'stepIndex',
} as const;

/**
 * 观察者事件类型
 */
export const OBSERVER_EVENTS = {
  EXECUTION_START: 'execution:start',
  EXECUTION_END: 'execution:end',
  EXECUTION_ERROR: 'execution:error',
  STEP_START: 'step:start',
  STEP_END: 'step:end',
  TOOL_CALL: 'tool:call',
  TOOL_RESULT: 'tool:result',
  TOOL_ERROR: 'tool:error',
  MESSAGE_CREATE: 'message:create',
  MESSAGE_UPDATE: 'message:update',
  TOKEN_USAGE: 'token:usage',
  RATE_LIMIT: 'rate:limit',
  RETRY_ATTEMPT: 'retry:attempt',
} as const;

/**
 * 健康检查端点
 */
export const HEALTH_CHECKS = {
  /** 默认健康检查路径 */
  DEFAULT_PATH: '/health',
  
  /** 默认就绪检查路径 */
  DEFAULT_READY_PATH: '/ready',
  
  /** 默认存活检查路径 */
  DEFAULT_LIVE_PATH: '/live',
  
  /** 健康检查超时（毫秒） */
  TIMEOUT: 5000,
} as const;

/**
 * 导出所有常量的联合类型
 */
export type TimeoutKey = keyof typeof DEFAULT_TIMEOUTS;
export type RetryKey = keyof typeof DEFAULT_RETRY;
export type TokenLimitKey = keyof typeof TOKEN_LIMITS;
export type ExecutionLimitKey = keyof typeof EXECUTION_LIMITS;
