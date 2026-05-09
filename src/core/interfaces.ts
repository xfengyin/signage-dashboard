/**
 * @fileOverview 核心接口定义 - 企业级Agent框架的抽象层
 * @module core/interfaces
 */

import type {
  Message,
  Content,
  ToolCall,
  ToolResult,
  ExecutionContext,
  ExecutionResult,
  ModelConfig,
  ToolConfig,
  AgentConfig,
} from './types';

/**
 * 工具接口 - 定义可执行工具的抽象
 * 
 * @description 
 * 工具是Agent执行任务的核心组件，遵循单一职责原则，
 * 每个工具负责特定的功能域。
 * 
 * @example
 * ```typescript
 * class CalculatorTool implements Tool {
 *   name = 'calculator';
 *   description = '执行数学计算';
 *   
 *   async validate(params: unknown): Promise<boolean> {
 *     return typeof params === 'object' && params !== null;
 *   }
 *   
 *   async execute(params: unknown, context?: ExecutionContext): Promise<ToolResult> {
 *     // 计算逻辑
 *   }
 * }
 * ```
 */
export interface Tool<Params = unknown, Result = unknown> {
  /** 工具唯一标识名称 */
  name: string;
  
  /** 工具功能描述，用于Agent理解和选择工具 */
  description: string;
  
  /** 工具输入参数模式定义（可选，支持JSON Schema或Zod schema） */
  inputSchema?: object;
  
  /** 工具输出结果模式定义（可选） */
  outputSchema?: object;
  
  /**
   * 验证输入参数是否符合工具要求
   * @param params - 待验证的参数
   * @returns 验证结果
   */
  validate(params: Params): Promise<boolean>;
  
  /**
   * 执行工具逻辑
   * @param params - 执行参数
   * @param context - 执行上下文
   * @returns 工具执行结果
   */
  execute(params: Params, context?: ExecutionContext): Promise<Result>;
  
  /**
   * 获取工具元数据（可选）
   */
  metadata?: Record<string, unknown>;
}

/**
 * 模型接口 - 定义AI模型的抽象
 * 
 * @description
 * 模型接口遵循依赖倒置原则，使框架不依赖具体的模型实现。
 * 支持多种模型类型：文本生成、流式生成、嵌入向量等。
 */
export interface Model {
  /** 模型标识符 */
  name: string;
  
  /** 模型类型 */
  type: 'chat' | 'completion' | 'embedding' | 'multimodal';
  
  /** 模型配置 */
  config?: ModelConfig;
  
  /**
   * 生成非流式响应
   * @param messages - 消息列表
   * @param context - 执行上下文
   * @returns 生成结果
   */
  generate(
    messages: Message[],
    context?: ExecutionContext
  ): Promise<ModelResponse>;
  
  /**
   * 生成流式响应
   * @param messages - 消息列表
   * @param context - 执行上下文
   * @returns 异步迭代器，用于流式处理
   */
  stream(
    messages: Message[],
    context?: ExecutionContext
  ): AsyncGenerator<StreamChunk, void, unknown>;
  
  /**
   * 生成嵌入向量
   * @param input - 输入文本
   * @param context - 执行上下文
   * @returns 嵌入结果
   */
  embed(
    input: string | string[],
    context?: ExecutionContext
  ): Promise<EmbeddingResult>;
  
  /**
   * 获取模型供应商信息（可选）
   */
  provider?: ModelProvider;
}

/**
 * 模型响应
 */
export interface ModelResponse {
  /** 生成的文本内容 */
  content: Content;
  
  /** 使用的token数量 */
  usage?: TokenUsage;
  
  /** 停止原因 */
  finishReason?: 'stop' | 'length' | 'content_filter' | 'error';
  
  /** 模型生成的元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 流式输出块
 */
export interface StreamChunk {
  /** 增量内容 */
  delta: string;
  
  /** 是否为最终块 */
  done: boolean;
  
  /** 当前块的使用量 */
  usage?: TokenUsage;
  
  /** 索引（用于并行处理） */
  index?: number;
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
}

/**
 * 嵌入结果
 */
export interface EmbeddingResult {
  /** 嵌入向量数组 */
  embeddings: number[][];
  
  /** 使用的token数 */
  usage?: TokenUsage;
  
  /** 模型信息 */
  model?: string;
}

/**
 * 模型供应商信息
 */
export interface ModelProvider {
  /** 供应商名称 */
  name: string;
  
  /** 供应商类型 */
  type: 'openai' | 'anthropic' | 'google' | 'azure' | 'custom';
  
  /** API基础地址 */
  baseUrl?: string;
  
  /** 版本信息 */
  version?: string;
}

/**
 * 技能接口 - 定义可组合的业务能力单元
 * 
 * @description
 * 技能是比工具更高层次的抽象，代表一组相关的工具和能力。
 * 支持嵌套组合，形成技能树结构。
 */
export interface Skill {
  /** 技能唯一标识 */
  id: string;
  
  /** 技能名称 */
  name: string;
  
  /** 技能描述 */
  description: string;
  
  /** 技能版本 */
  version: string;
  
  /** 技能分类 */
  category?: string;
  
  /** 依赖的其他技能 */
  dependencies?: string[];
  
  /** 技能配置 */
  config?: Record<string, unknown>;
  
  /**
   * 初始化技能
   * @param context - 初始化上下文
   */
  initialize?(context: ExecutionContext): Promise<void>;
  
  /**
   * 执行技能
   * @param input - 技能输入
   * @param context - 执行上下文
   * @returns 技能执行结果
   */
  execute(input: unknown, context?: ExecutionContext): Promise<SkillResult>;
  
  /**
   * 验证技能是否适用于给定任务
   * @param task - 任务描述
   * @returns 适用性评分
   */
  match?(task: string): Promise<number>;
  
  /**
   * 清理技能资源
   */
  cleanup?(): Promise<void>;
}

/**
 * 技能执行结果
 */
export interface SkillResult {
  /** 执行状态 */
  status: 'success' | 'failure' | 'partial';
  
  /** 结果数据 */
  data?: unknown;
  
  /** 错误信息 */
  error?: string;
  
  /** 执行元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * Agent接口 - 定义智能体的核心抽象
 * 
 * @description
 * Agent是框架的核心组件，负责：
 * - 理解用户意图
 * - 规划执行步骤
 * - 调用工具和技能
 * - 管理执行上下文
 * 
 * 遵循开闭原则，允许扩展但不允许修改核心接口。
 */
export interface Agent {
  /** Agent唯一标识 */
  id: string;
  
  /** Agent名称 */
  name: string;
  
  /** Agent描述 */
  description: string;
  
  /** Agent版本 */
  version: string;
  
  /** 绑定的模型 */
  model: Model;
  
  /** Agent配置 */
  config: AgentConfig;
  
  /**
   * 注册的工具列表
   */
  tools: Map<string, Tool>;
  
  /**
   * 注册的技能列表
   */
  skills: Map<string, Skill>;
  
  /**
   * 执行用户请求
   * @param input - 用户输入
   * @param context - 执行上下文
   * @returns 执行结果
   */
  execute(
    input: string | Message[],
    context?: Partial<ExecutionContext>
  ): Promise<ExecutionResult>;
  
  /**
   * 规划执行步骤
   * @param task - 任务描述
   * @param context - 执行上下文
   * @returns 执行计划
   */
  plan(
    task: string,
    context?: Partial<ExecutionContext>
  ): Promise<ExecutionPlan>;
  
  /**
   * 注册工具
   * @param tool - 工具实例
   */
  registerTool(tool: Tool): void;
  
  /**
   * 注册技能
   * @param skill - 技能实例
   */
  registerSkill(skill: Skill): void;
  
  /**
   * 移除工具
   * @param name - 工具名称
   */
  removeTool(name: string): boolean;
  
  /**
   * 移除技能
   * @param id - 技能ID
   */
  removeSkill(id: string): boolean;
  
  /**
   * 获取Agent状态
   */
  getState?(): Promise<AgentState>;
  
  /**
   * 重置Agent状态
   */
  reset?(): Promise<void>;
}

/**
 * 执行计划
 */
export interface ExecutionPlan {
  /** 计划ID */
  id: string;
  
  /** 步骤列表 */
  steps: PlanStep[];
  
  /** 估计的token消耗 */
  estimatedTokens?: TokenUsage;
  
  /** 计划创建时间 */
  createdAt: Date;
  
  /** 计划元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 计划步骤
 */
export interface PlanStep {
  /** 步骤索引 */
  index: number;
  
  /** 步骤描述 */
  description: string;
  
  /** 关联的工具（如果有） */
  tool?: string;
  
  /** 关联的技能（如果有） */
  skill?: string;
  
  /** 步骤依赖 */
  dependencies?: number[];
  
  /** 预估执行时间（毫秒） */
  estimatedDuration?: number;
}

/**
 * Agent状态
 */
export interface AgentState {
  /** 当前状态 */
  status: 'idle' | 'running' | 'paused' | 'error';
  
  /** 当前执行的请求ID */
  currentRequestId?: string;
  
  /** 已使用的token数 */
  usage?: TokenUsage;
  
  /** 最后活跃时间 */
  lastActiveAt: Date;
  
  /** 错误信息（如果有） */
  error?: string;
}

/**
 * 执行上下文接口
 * 
 * @description
 * 定义执行上下文的只读接口，用于在组件间传递执行状态。
 */
export interface Context {
  /** 请求ID */
  requestId: string;
  
  /** 用户ID */
  userId?: string;
  
  /** 会话ID */
  sessionId?: string;
  
  /** 时间戳 */
  timestamp: number;
  
  /** 附加数据 */
  data: Map<string, unknown>;
  
  /**
   * 获取上下文值
   */
  get<T>(key: string): T | undefined;
  
  /**
   * 设置上下文值
   */
  set<T>(key: string, value: T): void;
  
  /**
   * 检查键是否存在
   */
  has(key: string): boolean;
  
  /**
   * 删除键
   */
  delete(key: string): boolean;
  
  /**
   * 清除所有数据
   */
  clear(): void;
}

/**
 * 执行结果接口
 * 
 * @description
 * 定义执行结果的只读接口。
 */
export interface Result<T = unknown, E = Error> {
  /** 是否成功 */
  success: boolean;
  
  /** 结果数据 */
  data?: T;
  
  /** 错误信息 */
  error?: E;
  
  /** 执行元数据 */
  metadata?: RecordMetadata;
  
  /**
   * 映射结果数据
   */
  map<U>(fn: (data: T) => U): Result<U, E>;
  
  /**
   * 处理错误
   */
  catch<U>(fn: (error: E) => U): Result<T, never> | U;
  
  /**
   * 转换为Promise
   */
  toPromise(): Promise<T>;
}

/**
 * 结果元数据
 */
export interface RecordMetadata {
  /** 执行时间（毫秒） */
  duration?: number;
  
  /** 使用的token数 */
  usage?: TokenUsage;
  
  /** 调用链追踪ID */
  traceId?: string;
  
  /** 步骤计数 */
  stepCount?: number;
  
  /** 自定义元数据 */
  [key: string]: unknown;
}

/**
 * 配置接口 - 定义各类配置的基类
 */
export interface Config {
  /** 配置ID */
  id?: string;
  
  /** 配置名称 */
  name?: string;
  
  /** 配置描述 */
  description?: string;
  
  /** 配置验证 */
  validate(): boolean;
  
  /** 获取配置默认值 */
  getDefaults?(): Record<string, unknown>;
  
  /** 合并配置 */
  merge?(config: Partial<this>): this;
}

/**
 * 工厂接口 - 用于创建各类组件
 */
export interface Factory<T, C = unknown> {
  /**
   * 创建实例
   * @param config - 配置
   */
  create(config: C): Promise<T>;
  
  /**
   * 验证配置
   * @param config - 配置
   */
  validate?(config: C): Promise<boolean>;
  
  /**
   * 获取默认配置
   */
  getDefaultConfig?(): C;
}

/**
 * 中间件接口 - 用于扩展Agent行为
 */
export interface Middleware {
  /** 中间件名称 */
  name: string;
  
  /** 执行顺序优先级 */
  priority: number;
  
  /**
   * 处理请求
   * @param context - 执行上下文
   * @param next - 下一个处理器
   */
  handle(
    context: ExecutionContext,
    next: () => Promise<ExecutionResult>
  ): Promise<ExecutionResult>;
}

/**
 * 观察者接口 - 用于监控Agent执行
 */
export interface Observer {
  /** 观察者名称 */
  name: string;
  
  /**
   * 观察执行开始
   */
  onStart?(context: ExecutionContext): void | Promise<void>;
  
  /**
   * 观察执行步骤
   */
  onStep?(step: PlanStep, context: ExecutionContext): void | Promise<void>;
  
  /**
   * 观察工具调用
   */
  onToolCall?(tool: Tool, params: unknown): void | Promise<void>;
  
  /**
   * 观察工具结果
   */
  onToolResult?(result: ToolResult): void | Promise<void>;
  
  /**
   * 观察执行完成
   */
  onComplete?(result: ExecutionResult): void | Promise<void>;
  
  /**
   * 观察执行错误
   */
  onError?(error: Error, context: ExecutionContext): void | Promise<void>;
}

/**
 * 存储接口 - 用于持久化状态
 */
export interface Storage {
  /**
   * 存储值
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  
  /**
   * 获取值
   */
  get<T>(key: string): Promise<T | undefined>;
  
  /**
   * 删除值
   */
  delete(key: string): Promise<boolean>;
  
  /**
   * 检查键是否存在
   */
  has(key: string): Promise<boolean>;
  
  /**
   * 清除所有数据
   */
  clear(): Promise<void>;
  
  /**
   * 获取多个值
   */
  getMany<T>(keys: string[]): Promise<(T | undefined)[]>;
  
  /**
   * 设置多个值
   */
  setMany<T>(entries: Record<string, T>, ttl?: number): Promise<void>;
}

/**
 * 工具调用器接口 - 封装工具调用逻辑
 */
export interface ToolCaller {
  /**
   * 调用单个工具
   */
  call(
    tool: Tool,
    params: unknown,
    context?: ExecutionContext
  ): Promise<ToolResult>;
  
  /**
   * 并行调用多个工具
   */
  callMany(
    calls: Array<{ tool: Tool; params: unknown }>,
    context?: ExecutionContext
  ): Promise<ToolResult[]>;
  
  /**
   * 串行调用工具链
   */
  callChain(
    calls: Array<{ tool: Tool; params: unknown }>,
    context?: ExecutionContext
  ): Promise<ToolResult[]>;
}

/**
 * 计划器接口 - 抽象执行计划生成
 */
export interface Planner {
  /**
   * 生成执行计划
   */
  plan(
    task: string,
    context: ExecutionContext
  ): Promise<ExecutionPlan>;
  
  /**
   * 优化现有计划
   */
  optimize?(plan: ExecutionPlan): Promise<ExecutionPlan>;
  
  /**
   * 验证计划可行性
   */
  validate?(plan: ExecutionPlan): Promise<boolean>;
}

/**
 * 重试策略接口
 */
export interface RetryStrategy {
  /** 最大重试次数 */
  maxRetries: number;
  
  /** 初始延迟（毫秒） */
  initialDelay: number;
  
  /** 最大延迟（毫秒） */
  maxDelay: number;
  
  /** 退避策略 */
  backoff: 'linear' | 'exponential' | 'fixed';
  
  /** 重试条件判断 */
  shouldRetry?(error: Error, attempt: number): boolean;
  
  /** 计算延迟时间 */
  getDelay(attempt: number): number;
}

/**
 * 限流器接口
 */
export interface RateLimiter {
  /** 检查是否可以执行 */
  check(): Promise<boolean>;
  
  /** 记录执行 */
  record(): Promise<void>;
  
  /** 获取当前限制信息 */
  getLimit(): Promise<RateLimitInfo>;
  
  /** 等待直到可以执行 */
  wait(): Promise<void>;
}

/**
 * 限流信息
 */
export interface RateLimitInfo {
  /** 每时间窗口的最大请求数 */
  maxRequests: number;
  
  /** 时间窗口（毫秒） */
  windowMs: number;
  
  /** 剩余请求数 */
  remaining: number;
  
  /** 重置时间戳 */
  resetAt: number;
}

export interface Plugin {
  name: string;
  version?: string;
  initialize?(agent: Agent): Promise<void>;
  beforeExecute?(context: ExecutionContext): Promise<void>;
  afterExecute?(context: ExecutionContext, result: ExecutionResult): Promise<void>;
  onError?(error: Error, context: ExecutionContext): Promise<void>;
  cleanup?(): Promise<void>;
}

export interface CacheStrategy {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

export interface EventBus {
  publish<T>(event: string, data: T): void;
  subscribe<T>(event: string, handler: (data: T) => void): () => void;
  unsubscribe(event: string): void;
  once<T>(event: string, handler: (data: T) => void): () => void;
}

export interface Pipeline {
  use(middleware: Middleware): Pipeline;
  execute(context: ExecutionContext): Promise<ExecutionResult>;
  error(handler: (error: Error, context: ExecutionContext) => Promise<void>): Pipeline;
}

export interface Metrics {
  increment(name: string, value?: number, labels?: Record<string, string>): void;
  decrement(name: string, value?: number, labels?: Record<string, string>): void;
  gauge(name: string, value: number, labels?: Record<string, string>): void;
  histogram(name: string, value: number, labels?: Record<string, string>): void;
  timing(name: string, value: number, labels?: Record<string, string>): void;
}

export interface HealthCheck {
  name: string;
  check(): Promise<{ healthy: boolean; message?: string }>;
}

export interface Transformer<T = unknown, R = unknown> {
  transform(input: T): R | Promise<R>;
}

export interface Validator<T = unknown> {
  validate(input: T): boolean | Promise<boolean>;
  errors?(): string[];
}

export interface Serializer<T = unknown> {
  serialize(value: T): string | Promise<string>;
  deserialize(data: string): T | Promise<T>;
}
