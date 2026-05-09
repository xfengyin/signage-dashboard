/**
 * @fileOverview 类型定义 - 企业级Agent框架的基础类型系统
 * @module core/types
 */

/**
 * 消息角色枚举
 */
export type Role = 'system' | 'user' | 'assistant' | 'tool' | 'function';

/**
 * 内容类型
 */
export type ContentType = 'text' | 'image' | 'audio' | 'video' | 'file' | 'tool_use' | 'tool_result';

/**
 * 文本内容
 */
export interface TextContent {
  type: 'text';
  text: string;
}

/**
 * 图片内容
 */
export interface ImageContent {
  type: 'image';
  url?: string;
  base64?: string;
  mimeType?: string;
  detail?: 'low' | 'high' | 'auto';
}

/**
 * 音频内容
 */
export interface AudioContent {
  type: 'audio';
  url?: string;
  base64?: string;
  mimeType?: string;
  duration?: number;
}

/**
 * 视频内容
 */
export interface VideoContent {
  type: 'video';
  url?: string;
  base64?: string;
  mimeType?: string;
  duration?: number;
}

/**
 * 文件内容
 */
export interface FileContent {
  type: 'file';
  url?: string;
  base64?: string;
  mimeType?: string;
  name: string;
  size?: number;
}

/**
 * 工具调用内容
 */
export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * 工具结果内容
 */
export interface ToolResultContent {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError?: boolean;
}

/**
 * 内容联合类型
 */
export type Content = string | TextContent | ImageContent | AudioContent | VideoContent | FileContent | ToolUseContent | ToolResultContent;

/**
 * 消息元数据
 */
export interface MessageMetadata {
  /** 消息创建时间 */
  createdAt?: Date;
  
  /** 消息更新时间 */
  updatedAt?: Date;
  
  /** 消息作者 */
  author?: string;
  
  /** 消息语言 */
  language?: string;
  
  /** 消息标签 */
  tags?: string[];
  
  /** 自定义元数据 */
  [key: string]: unknown;
}

/**
 * 消息接口
 * 
 * @description
 * 定义对话消息的结构，支持多种内容类型和元数据。
 * 遵循消息队列的最佳实践，包含完整的时间戳和追踪信息。
 */
export interface Message {
  /** 消息唯一标识 */
  id?: string;
  
  /** 消息角色 */
  role: Role;
  
  /** 消息内容 */
  content: Content;
  
  /** 消息元数据 */
  metadata?: MessageMetadata;
  
  /** 父消息ID（用于消息树结构） */
  parentId?: string;
  
  /** 根消息ID（用于会话追踪） */
  rootId?: string;
  
  /** 函数名称（仅当role为function时） */
  name?: string;
  
  /** 函数调用ID（仅当role为tool时） */
  toolCallId?: string;
}

/**
 * 工具调用状态
 */
export type ToolCallStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * 工具调用接口
 * 
 * @description
 * 定义工具调用的请求结构，包含调用参数和元数据。
 * 支持异步调用和流式处理场景。
 */
export interface ToolCall {
  /** 调用唯一标识 */
  id: string;
  
  /** 调用的工具名称 */
  name: string;
  
  /** 调用参数 */
  arguments: Record<string, unknown>;
  
  /** 调用状态 */
  status: ToolCallStatus;
  
  /** 创建时间戳 */
  createdAt: number;
  
  /** 开始执行时间戳 */
  startedAt?: number;
  
  /** 完成时间戳 */
  completedAt?: number;
  
  /** 调用元数据 */
  metadata?: Record<string, unknown>;
  
  /** 重试次数 */
  retryCount?: number;
  
  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * 工具结果接口
 * 
 * @description
 * 定义工具执行的返回结果结构。
 * 包含成功和失败两种状态的完整信息。
 */
export interface ToolResult {
  /** 对应的工具调用ID */
  callId: string;
  
  /** 工具名称 */
  name: string;
  
  /** 执行结果 */
  result?: unknown;
  
  /** 是否成功 */
  success: boolean;
  
  /** 执行耗时（毫秒） */
  duration?: number;
  
  /** 错误信息（如果失败） */
  error?: string;
  
  /** 错误代码 */
  errorCode?: string;
  
  /** Token使用量 */
  tokenUsage?: TokenUsage;
  
  /** 结果元数据 */
  metadata?: Record<string, unknown>;
  
  /** 执行时间戳 */
  timestamp: number;
}

/**
 * Token使用量
 */
export interface TokenUsage {
  /** 输入token数 */
  inputTokens: number;
  
  /** 输出token数 */
  outputTokens: number;
  
  /** 总token数 */
  totalTokens: number;
  
  /** Token计费详情 */
  breakdown?: {
    promptTokens: number;
    completionTokens: number;
    reasoningTokens?: number;
  };
}

/**
 * 执行状态枚举
 */
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';

/**
 * 执行阶段枚举
 */
export type ExecutionPhase = 
  | 'init'
  | 'parsing'
  | 'planning'
  | 'tool_selection'
  | 'execution'
  | 'evaluation'
  | 'finalizing'
  | 'done';

/**
 * 执行上下文接口
 * 
 * @description
 * 定义Agent执行过程中的上下文状态。
 * 包含请求信息、会话信息、变量存储等。
 * 支持嵌套作用域和变量覆盖。
 */
export interface ExecutionContext {
  /** 请求唯一标识 */
  requestId: string;
  
  /** 用户标识 */
  userId?: string;
  
  /** 会话标识 */
  sessionId?: string;
  
  /** 根请求ID（用于分布式追踪） */
  rootRequestId?: string;
  
  /** 父请求ID（用于嵌套执行） */
  parentRequestId?: string;
  
  /** 执行状态 */
  status: ExecutionStatus;
  
  /** 当前执行阶段 */
  phase: ExecutionPhase;
  
  /** 消息历史 */
  messages: Message[];
  
  /** 变量存储 */
  variables: Map<string, unknown>;
  
  /** 工具调用列表 */
  toolCalls: ToolCall[];
  
  /** 当前Token使用量 */
  tokenUsage: TokenUsage;
  
  /** 创建时间戳 */
  createdAt: number;
  
  /** 最后更新时间戳 */
  updatedAt: number;
  
  /** 超时时间（毫秒） */
  timeout?: number;
  
  /** 最大循环次数 */
  maxIterations?: number;
  
  /** 当前循环次数 */
  currentIteration: number;
  
  /** 执行追踪ID */
  traceId?: string;
  
  /** 执行标签 */
  tags?: string[];
  
  /** 上下文元数据 */
  metadata: Record<string, unknown>;
  
  /** Cancellation signal for aborting execution */
  signal?: AbortSignal;
}

/**
 * 执行结果接口
 * 
 * @description
 * 定义Agent执行完成后的返回结果。
 * 包含完整的执行信息、输出和统计。
 */
export interface ExecutionResult {
  /** 请求标识 */
  requestId: string;
  
  /** 执行状态 */
  status: ExecutionStatus;
  
  /** 最终输出消息 */
  output: Message;
  
  /** 所有消息列表 */
  messages: Message[];
  
  /** 所有工具调用 */
  toolCalls: ToolCall[];
  
  /** 所有工具结果 */
  toolResults: ToolResult[];
  
  /** Token使用量统计 */
  tokenUsage: TokenUsage;
  
  /** 执行耗时（毫秒） */
  duration: number;
  
  /** 执行阶段历史 */
  phases: Array<{
    phase: ExecutionPhase;
    startedAt: number;
    endedAt?: number;
    duration?: number;
  }>;
  
  /** 错误信息（如果失败） */
  error?: {
    message: string;
    code?: string;
    stack?: string;
    recoverable: boolean;
  };
  
  /** 是否被取消 */
  cancelled: boolean;
  
  /** 执行元数据 */
  metadata: Record<string, unknown>;
  
  /** 追踪信息 */
  traces?: Array<{
    timestamp: number;
    event: string;
    data?: unknown;
  }>;
}

/**
 * Agent配置接口
 * 
 * @description
 * 定义Agent的初始化和运行时配置。
 * 包含模型参数、执行策略、限流设置等。
 */
export interface AgentConfig {
  /** 最大思考步数 */
  maxSteps?: number;
  
  /** 执行超时时间（毫秒） */
  executionTimeout?: number;
  
  /** 单步超时时间（毫秒） */
  stepTimeout?: number;
  
  /** 是否启用流式输出 */
  streaming?: boolean;
  
  /** Temperature参数 */
  temperature?: number;
  
  /** Top-p采样参数 */
  topP?: number;
  
  /** 最大回复token数 */
  maxTokens?: number;
  
  /** 停止序列 */
  stopSequences?: string[];
  
  /** 工具选择策略 */
  toolChoice?: 'auto' | 'required' | 'none' | {
    type: 'function';
    function: { name: string };
  };
  
  /** 工具调用超时时间（毫秒） */
  toolTimeout?: number;
  
  /** 工具并行调用最大数 */
  maxParallelTools?: number;
  
  /** 是否启用技能匹配 */
  enableSkillMatching?: boolean;
  
  /** 技能匹配阈值 */
  skillMatchThreshold?: number;
  
  /** 重试配置 */
  retryConfig?: RetryConfig;
  
  /** 限流配置 */
  rateLimitConfig?: RateLimitConfig;
  
  /** 观察者列表 */
  observers?: string[];
  
  /** 自定义配置 */
  custom?: Record<string, unknown>;
}

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  
  /** 初始延迟（毫秒） */
  initialDelay: number;
  
  /** 最大延迟（毫秒） */
  maxDelay: number;
  
  /** 退避策略 */
  backoff: 'linear' | 'exponential' | 'fixed';
  
  /** 可重试的错误码列表 */
  retryableErrors?: string[];
  
  /** 不重试的错误码列表 */
  nonRetryableErrors?: string[];
}

/**
 * 限流配置
 */
export interface RateLimitConfig {
  /** 每时间窗口的最大请求数 */
  maxRequests: number;
  
  /** 时间窗口（毫秒） */
  windowMs: number;
  
  /** 每时间窗口的最大Token数 */
  maxTokens?: number;
  
  /** 是否启用队列 */
  enableQueue?: boolean;
  
  /** 队列最大长度 */
  maxQueueSize?: number;
}

/**
 * 模型配置接口
 * 
 * @description
 * 定义模型的初始化和调用配置。
 * 支持多种模型供应商和配置参数。
 */
export interface ModelConfig {
  /** 模型标识符 */
  model: string;
  
  /** 模型类型 */
  type?: 'chat' | 'completion' | 'embedding' | 'multimodal';
  
  /** 供应商类型 */
  provider?: 'openai' | 'anthropic' | 'google' | 'azure' | 'local' | 'custom';
  
  /** API基础地址 */
  baseUrl?: string;
  
  /** API密钥 */
  apiKey?: string;
  
  /** 组织ID（用于OpenAI等） */
  organization?: string;
  
  /** 项目ID */
  projectId?: string;
  
  /** 默认Temperature */
  temperature?: number;
  
  /** 默认Top-p */
  topP?: number;
  
  /** 默认最大Token数 */
  maxTokens?: number;
  
  /** 停止序列 */
  stop?: string[];
  
  /** 频率惩罚 */
  frequencyPenalty?: number;
  
  /** 存在惩罚 */
  presencePenalty?: number;
  
  /** 推理参数 */
  reasoning?: {
    effort?: 'low' | 'medium' | 'high';
    budget?: number;
  };
  
  /** 系统提示词 */
  systemPrompt?: string;
  
  /** 请求头 */
  headers?: Record<string, string>;
  
  /** 请求超时（毫秒） */
  timeout?: number;
  
  /** 是否启用缓存 */
  cacheEnabled?: boolean;
  
  /** 自定义参数 */
  customParams?: Record<string, unknown>;
}

/**
 * 工具配置接口
 * 
 * @description
 * 定义工具的初始化和运行时配置。
 */
export interface ToolConfig {
  /** 工具名称 */
  name: string;
  
  /** 工具描述 */
  description?: string;
  
  /** 是否启用 */
  enabled?: boolean;
  
  /** 执行超时（毫秒） */
  timeout?: number;
  
  /** 重试配置 */
  retryConfig?: RetryConfig;
  
  /** 限流配置 */
  rateLimitConfig?: RateLimitConfig;
  
  /** 工具特定参数 */
  parameters?: Record<string, unknown>;
  
  /** 输入模式定义（JSON Schema） */
  inputSchema?: object;
  
  /** 输出模式定义（JSON Schema） */
  outputSchema?: object;
  
  /** 依赖的工具列表 */
  dependencies?: string[];
  
  /** 优先级（数字越小优先级越高） */
  priority?: number;
  
  /** 可见性 */
  visibility?: 'public' | 'private' | 'protected';
  
  /** 标签 */
  tags?: string[];
  
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 技能配置接口
 * 
 * @description
 * 定义技能的初始化和运行时配置。
 */
export interface SkillConfig {
  /** 技能标识 */
  id: string;
  
  /** 技能名称 */
  name: string;
  
  /** 技能描述 */
  description?: string;
  
  /** 技能版本 */
  version?: string;
  
  /** 是否启用 */
  enabled?: boolean;
  
  /** 技能配置参数 */
  parameters?: Record<string, unknown>;
  
  /** 依赖的技能列表 */
  dependencies?: string[];
  
  /** 优先级 */
  priority?: number;
  
  /** 自动初始化 */
  autoInitialize?: boolean;
  
  /** 自动清理 */
  autoCleanup?: boolean;
  
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 会话配置接口
 * 
 * @description
 * 定义会话的初始化和运行时配置。
 */
export interface SessionConfig {
  /** 会话标识 */
  sessionId?: string;
  
  /** 用户标识 */
  userId?: string;
  
  /** 会话名称 */
  name?: string;
  
  /** 会话描述 */
  description?: string;
  
  /** 会话类型 */
  type?: 'chat' | 'task' | 'workflow';
  
  /** 最大消息数 */
  maxMessages?: number;
  
  /** 最大Token数 */
  maxTokens?: number;
  
  /** 消息摘要策略 */
  summarization?: {
    enabled: boolean;
    threshold?: number;
    method?: 'simple' | 'abstractive';
  };
  
  /** 会话过期时间（毫秒） */
  ttl?: number;
  
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 会话状态
 */
export interface SessionState {
  /** 会话标识 */
  sessionId: string;
  
  /** 会话状态 */
  status: 'active' | 'paused' | 'archived' | 'deleted';
  
  /** 消息数 */
  messageCount: number;
  
  /** Token使用量 */
  tokenUsage: TokenUsage;
  
  /** 创建时间 */
  createdAt: Date;
  
  /** 最后活跃时间 */
  lastActiveAt: Date;
  
  /** 上下文摘要 */
  summary?: string;
  
  /** 元数据 */
  metadata: Record<string, unknown>;
}

/**
 * 观察者事件类型
 */
export type ObserverEventType = 
  | 'execution:start'
  | 'execution:end'
  | 'execution:error'
  | 'step:start'
  | 'step:end'
  | 'tool:call'
  | 'tool:result'
  | 'tool:error'
  | 'message:create'
  | 'message:update'
  | 'token:usage'
  | 'rate:limit'
  | 'retry:attempt';

/**
 * 观察者事件
 */
export interface ObserverEvent {
  /** 事件类型 */
  type: ObserverEventType;
  
  /** 事件时间戳 */
  timestamp: number;
  
  /** 关联的请求ID */
  requestId?: string;
  
  /** 事件数据 */
  data?: unknown;
  
  /** 错误信息（如果有） */
  error?: Error;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  valid: boolean;
  
  /** 错误信息 */
  errors?: Array<{
    path: string;
    message: string;
    code?: string;
  }>;
  
  /** 警告信息 */
  warnings?: Array<{
    path: string;
    message: string;
  }>;
}

/**
 * 健康检查结果
 */
export interface HealthCheckResult {
  /** 是否健康 */
  healthy: boolean;
  
  /** 组件名称 */
  component: string;
  
  /** 检查时间 */
  timestamp: Date;
  
  /** 响应时间（毫秒） */
  responseTime?: number;
  
  /** 详细信息 */
  details?: Record<string, unknown>;
  
  /** 错误信息（如果有） */
  error?: string;
}
