/**
 * @fileOverview Agent主类 - 企业级Agent框架的核心实现
 * @module agent
 * @description 实现BaseAgent抽象类，整合所有模块，提供完整的Agent执行能力
 */

import type {
  Agent,
  AgentConfig,
  ExecutionContext,
  ExecutionResult,
  ExecutionPlan,
  ExecutionPhase,
  ExecutionStatus,
  Message,
  Model,
  ModelResponse,
  Tool,
  ToolCall,
  ToolResult,
  Skill,
  SkillResult,
  Middleware,
  Observer,
  ToolCaller,
} from './core/interfaces';

import {
  AgentConfig as AgentConfigType,
  ModelConfig,
  RetryConfig,
  RateLimitConfig,
  TokenUsage,
} from './core/types';

import {
  EXECUTION_STATUS,
  EXECUTION_PHASES,
  TOOL_CALL_STATUS,
  DEFAULT_TIMEOUTS,
  DEFAULT_RETRY,
} from './core/constants';

import { ResilientClient, ResilientOperationConfig } from './resilience';
import { initializeObservability, Observability, ObservabilityConfig } from './observability';
import { MiddlewarePipeline, createMiddlewarePipeline, MiddlewareConfig } from './middleware';
import { CircuitBreakerConfig } from './resilience/circuit-breaker';
import { RateLimiterConfig } from './resilience/rate-limiter';
import { createLogger, Logger, LogLevel } from './observability/logger';
import { createMetricsCollector, MetricsCollector } from './observability/metrics';
import { createTracer, Tracer } from './observability/tracer';
import { createMonitor, Monitor } from './observability/monitor';

export interface BaseAgentConfig {
  id: string;
  name: string;
  description?: string;
  version?: string;
  model: Model;
  config?: Partial<AgentConfigType>;
  retryConfig?: Partial<RetryConfig>;
  rateLimitConfig?: Partial<RateLimiterConfig>;
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
  observability?: ObservabilityConfig;
  middleware?: MiddlewareConfig;
  plugins?: AgentPlugin[];
  toolTimeout?: number;
  maxConcurrentTools?: number;
  enableSkillMatching?: boolean;
  skillMatchThreshold?: number;
  customContext?: Record<string, unknown>;
}

export interface AgentPlugin {
  name: string;
  initialize?: (agent: BaseAgent) => Promise<void>;
  beforeExecute?: (context: ExecutionContext) => Promise<void>;
  afterExecute?: (context: ExecutionContext, result: ExecutionResult) => Promise<void>;
  onError?: (error: Error, context: ExecutionContext) => Promise<void>;
  cleanup?: () => Promise<void>;
}

export interface ToolCallChain {
  id: string;
  calls: Array<{
    tool: Tool;
    params: unknown;
    result?: ToolResult;
  }>;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface AgentMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  averageTokenUsage: TokenUsage;
  toolCallStats: Map<string, {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageDuration: number;
  }>;
}

export abstract class BaseAgent implements Agent {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly model: Model;
  readonly config: AgentConfigType;
  
  readonly tools: Map<string, Tool> = new Map();
  readonly skills: Map<string, Skill> = new Map();
  
  private retryConfig: RetryConfig;
  private rateLimitConfig: RateLimitConfig;
  private circuitBreakerConfig: CircuitBreakerConfig;
  private observability?: Observability;
  private middlewarePipeline: MiddlewarePipeline;
  private plugins: AgentPlugin[] = [];
  private toolTimeout: number;
  private maxConcurrentTools: number;
  private enableSkillMatching: boolean;
  private skillMatchThreshold: number;
  private customContext: Record<string, unknown>;
  
  private resilientClient?: ResilientClient;
  private toolCaller: ToolCaller;
  private observers: Observer[] = [];
  
  private state: {
    status: 'idle' | 'running' | 'paused' | 'error';
    currentRequestId?: string;
    lastActiveAt: number;
    error?: Error;
  };
  
  private metrics: AgentMetrics;

  constructor(config: BaseAgentConfig) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description || '';
    this.version = config.version || '1.0.0';
    this.model = config.model;
    
    this.config = {
      maxSteps: config.config?.maxSteps || 100,
      executionTimeout: config.config?.executionTimeout || DEFAULT_TIMEOUTS.REQUEST,
      stepTimeout: config.config?.stepTimeout || DEFAULT_TIMEOUTS.STEP,
      streaming: config.config?.streaming || false,
      temperature: config.config?.temperature || 0.7,
      topP: config.config?.topP || 1.0,
      maxTokens: config.config?.maxTokens || 4096,
      toolTimeout: config.config?.toolTimeout || DEFAULT_TIMEOUTS.TOOL,
      maxParallelTools: config.config?.maxParallelTools || 3,
      enableSkillMatching: config.config?.enableSkillMatching || false,
      skillMatchThreshold: config.config?.skillMatchThreshold || 0.7,
      ...config.config,
    };

    this.retryConfig = {
      maxRetries: config.retryConfig?.maxRetries || DEFAULT_RETRY.MAX_RETRIES,
      initialDelay: config.retryConfig?.initialDelay || 1000,
      maxDelay: config.retryConfig?.maxDelay || 30000,
      backoff: config.retryConfig?.backoff || 'exponential',
      ...config.retryConfig,
    };

    this.rateLimitConfig = {
      maxRequests: config.rateLimitConfig?.maxRequests || 60,
      windowMs: config.rateLimitConfig?.windowMs || 60000,
      ...config.rateLimitConfig,
    };

    this.circuitBreakerConfig = {
      failureThreshold: config.circuitBreakerConfig?.failureThreshold || 5,
      successThreshold: config.circuitBreakerConfig?.successThreshold || 2,
      timeout: config.circuitBreakerConfig?.timeout || 60000,
      ...config.circuitBreakerConfig,
    };

    this.toolTimeout = config.toolTimeout || DEFAULT_TIMEOUTS.TOOL;
    this.maxConcurrentTools = config.maxConcurrentTools || 3;
    this.enableSkillMatching = config.enableSkillMatching || false;
    this.skillMatchThreshold = config.skillMatchThreshold || 0.7;
    this.customContext = config.customContext || {};

    this.state = {
      status: 'idle',
      lastActiveAt: Date.now(),
    };

    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      averageTokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      toolCallStats: new Map(),
    };

    this.initializeResilience();
    this.initializeObservability(config.observability);
    this.initializeMiddleware(config.middleware);
    
    if (config.plugins) {
      this.plugins = config.plugins;
    }

    this.toolCaller = this.createToolCaller();
  }

  private initializeResilience(): void {
    const resilientConfig: ResilientOperationConfig = {
      circuitBreaker: this.circuitBreakerConfig,
      rateLimiter: this.rateLimitConfig,
      retry: this.retryConfig,
      timeout: { timeout: this.toolTimeout },
    };

    this.resilientClient = new ResilientClient(resilientConfig);
  }

  private initializeObservability(config?: ObservabilityConfig): void {
    if (config) {
      this.observability = initializeObservability(config);
    } else {
      const logger = createLogger({
        level: LogLevel.INFO,
        transports: [new (require('./observability/logger').ConsoleTransport)()],
      });

      const tracer = createTracer({
        serviceName: this.name,
        serviceVersion: this.version,
      });

      const metrics = createMetricsCollector({
        serviceName: this.name,
        enableDefaultMetrics: true,
      });

      const monitor = createMonitor(logger, tracer, metrics, {
        serviceName: this.name,
        serviceVersion: this.version,
      });

      this.observability = { logger, tracer, metrics, monitor };
    }
  }

  private initializeMiddleware(config?: MiddlewareConfig): void {
    this.middlewarePipeline = createDefaultMiddlewarePipeline(config);
  }

  private createToolCaller(): ToolCaller {
    return {
      call: async (tool, params, context) => {
        return this.executeTool(tool, params, context);
      },
      callMany: async (calls, context) => {
        return this.executeToolsParallel(calls, context);
      },
      callChain: async (calls, context) => {
        return this.executeToolChain(calls, context);
      },
    };
  }

  async execute(
    input: string | Message[],
    context?: Partial<ExecutionContext>
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    this.state.status = 'running';
    this.state.currentRequestId = requestId;
    this.state.lastActiveAt = Date.now();

    const messages = this.normalizeInput(input);
    const executionContext = this.createExecutionContext(requestId, messages, context);

    await this.notifyObservers('onStart', executionContext);

    try {
      for (const plugin of this.plugins) {
        if (plugin.beforeExecute) {
          await plugin.beforeExecute(executionContext);
        }
      }

      const result = await this.middlewarePipeline.handle(
        executionContext,
        async () => this.executeCore(executionContext)
      );

      for (const plugin of this.plugins) {
        if (plugin.afterExecute) {
          await plugin.afterExecute(executionContext, result);
        }
      }

      await this.notifyObservers('onComplete', result);

      this.updateMetrics(result, Date.now() - startTime);
      this.state.status = 'idle';
      
      return result;
    } catch (error) {
      const errorResult = this.createErrorResult(
        executionContext,
        error as Error,
        Date.now() - startTime
      );

      for (const plugin of this.plugins) {
        if (plugin.onError) {
          await plugin.onError(error as Error, executionContext);
        }
      }

      await this.notifyObservers('onError', error as Error, executionContext);
      this.state.status = 'error';
      this.state.error = error as Error;

      return errorResult;
    }
  }

  private async executeCore(context: ExecutionContext): Promise<ExecutionResult> {
    context.phase = EXECUTION_PHASES.INITIALIZATION;
    
    let iteration = 0;
    const maxIterations = this.config.maxSteps || 100;

    while (iteration < maxIterations) {
      if (context.signal?.aborted) {
        return this.createCancelledResult(context);
      }

      context.currentIteration = iteration;
      context.phase = EXECUTION_PHASES.PLANNING;

      const plan = await this.plan(context.messages[context.messages.length - 1]?.content as string || '', context);
      
      context.phase = EXECUTION_PHASES.TOOL_SELECTION;
      const toolCalls = await this.selectTools(plan, context);

      if (toolCalls.length === 0) {
        context.phase = EXECUTION_PHASES.EVALUATION;
        break;
      }

      context.phase = EXECUTION_PHASES.EXECUTION;
      const toolResults = await this.executeToolCalls(toolCalls, context);

      context.phase = EXECUTION_PHASES.RESULT_PROCESSING;
      const responseMessage = await this.generateResponse(context, toolResults);

      context.messages.push(responseMessage);

      if (this.isExecutionComplete(responseMessage, toolResults)) {
        break;
      }

      iteration++;
    }

    context.phase = EXECUTION_PHASES.FINALIZATION;

    return this.createSuccessResult(context);
  }

  private async plan(task: string, context: ExecutionContext): Promise<ExecutionPlan> {
    const planningPrompt = this.buildPlanningPrompt(task, context);
    
    const planningMessages: Message[] = [
      ...context.messages,
      { role: 'user', content: planningPrompt },
    ];

    const response = await this.resilientClient!.execute(
      () => this.model.generate(planningMessages, context),
      { key: 'model:plan' }
    );

    const planText = typeof response.content === 'string' 
      ? response.content 
      : (response.content as any).text || '';

    return this.parsePlan(planText, context);
  }

  private buildPlanningPrompt(task: string, context: ExecutionContext): string {
    const availableTools = Array.from(this.tools.values())
      .map(t => `- ${t.name}: ${t.description}`)
      .join('\n');

    return `Task: ${task}

Available tools:
${availableTools}

Please plan the execution steps to complete this task. 
Respond with a structured plan in the following format:
STEP 1: [description] -> TOOL: [tool_name]
STEP 2: [description] -> TOOL: [tool_name]
...
`;
  }

  private parsePlan(planText: string, context: ExecutionContext): ExecutionPlan {
    const steps: Array<{
      index: number;
      description: string;
      tool?: string;
      dependencies?: number[];
      estimatedDuration?: number;
    }> = [];

    const lines = planText.split('\n');
    let currentStep: typeof steps[0] | null = null;

    for (const line of lines) {
      const stepMatch = line.match(/STEP\s+(\d+):\s*(.+?)\s*->\s*TOOL:\s*(.+)/i);
      if (stepMatch) {
        currentStep = {
          index: parseInt(stepMatch[1]) - 1,
          description: stepMatch[2].trim(),
          tool: stepMatch[3].trim(),
        };
        steps.push(currentStep);
      }
    }

    return {
      id: this.generateRequestId(),
      steps: steps.map(s => ({
        index: s.index,
        description: s.description,
        tool: s.tool,
        dependencies: s.dependencies,
        estimatedDuration: s.estimatedDuration,
      })),
      createdAt: new Date(),
      metadata: { rawPlan: planText },
    };
  }

  private async selectTools(plan: ExecutionPlan, context: ExecutionContext): Promise<ToolCall[]> {
    const toolCalls: ToolCall[] = [];

    for (const step of plan.steps) {
      if (!step.tool) continue;

      const tool = this.tools.get(step.tool);
      if (!tool) {
        this.observability?.logger.warn(`Tool not found: ${step.tool}`);
        continue;
      }

      const toolCall = await this.createToolCall(tool, {}, context);
      toolCalls.push(toolCall);
    }

    return toolCalls;
  }

  private async createToolCall(
    tool: Tool,
    params: unknown,
    context: ExecutionContext
  ): Promise<ToolCall> {
    return {
      id: this.generateRequestId(),
      name: tool.name,
      arguments: params as Record<string, unknown>,
      status: TOOL_CALL_STATUS.PENDING,
      createdAt: Date.now(),
    };
  }

  private async executeToolCalls(
    toolCalls: ToolCall[],
    context: ExecutionContext
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    const callEntries = toolCalls.map(tc => ({
      tool: this.tools.get(tc.name)!,
      params: tc.arguments,
    }));

    const parallelResults = await this.toolCaller.callMany(callEntries, context);
    
    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i];
      const result = parallelResults[i];
      
      toolCall.status = result.success ? TOOL_CALL_STATUS.COMPLETED : TOOL_CALL_STATUS.FAILED;
      if (!result.success) {
        toolCall.error = result.error;
      }
      
      context.toolCalls.push(toolCall);
      results.push(result);

      await this.notifyObservers('onToolResult', result);
    }

    return results;
  }

  private async executeTool(
    tool: Tool,
    params: unknown,
    context?: ExecutionContext
  ): Promise<ToolResult> {
    const callId = this.generateRequestId();
    const startTime = Date.now();

    const isValid = await tool.validate(params);
    if (!isValid) {
      return {
        callId,
        name: tool.name,
        success: false,
        error: 'Invalid parameters',
        errorCode: 'TOOL_VALIDATION_FAILED',
        timestamp: Date.now(),
      };
    }

    try {
      const result = await this.resilientClient!.execute(
        () => tool.execute(params, context),
        { key: `tool:${tool.name}`, timeout: this.toolTimeout }
      );

      return {
        callId,
        name: tool.name,
        result,
        success: true,
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        callId,
        name: tool.name,
        success: false,
        error: (error as Error).message,
        errorCode: (error as any).code || 'TOOL_EXECUTION_FAILED',
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };
    }
  }

  private async executeToolsParallel(
    calls: Array<{ tool: Tool; params: unknown }>,
    context?: ExecutionContext
  ): Promise<ToolResult[]> {
    const chunks: Array<Array<{ tool: Tool; params: unknown }>> = [];
    
    for (let i = 0; i < calls.length; i += this.maxConcurrentTools) {
      chunks.push(calls.slice(i, i + this.maxConcurrentTools));
    }

    const results: ToolResult[] = [];

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(call => this.executeTool(call.tool, call.params, context))
      );
      results.push(...chunkResults);
    }

    return results;
  }

  private async executeToolChain(
    calls: Array<{ tool: Tool; params: unknown }>,
    context?: ExecutionContext
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const call of calls) {
      const result = await this.executeTool(call.tool, call.params, context);
      results.push(result);
      
      if (!result.success) {
        break;
      }
    }

    return results;
  }

  private async generateResponse(
    context: ExecutionContext,
    toolResults: ToolResult[]
  ): Promise<Message> {
    const toolResultMessages: Message[] = toolResults.map(result => ({
      role: 'tool' as const,
      toolCallId: result.callId,
      content: result.success 
        ? JSON.stringify(result.result) 
        : `Error: ${result.error}`,
    }));

    const messages = [
      ...context.messages,
      ...toolResultMessages,
    ];

    const response = await this.resilientClient!.execute(
      () => this.model.generate(messages, context),
      { key: 'model:generate' }
    );

    return {
      role: 'assistant',
      content: response.content,
      metadata: {
        tokenUsage: response.usage,
        finishReason: response.finishReason,
      },
    };
  }

  private isExecutionComplete(
    response: Message,
    toolResults: ToolResult[]
  ): boolean {
    const content = typeof response.content === 'string'
      ? response.content
      : (response.content as any).text || '';

    const hasMoreWork = content.toLowerCase().includes('continue') ||
                        content.toLowerCase().includes('next step') ||
                        content.toLowerCase().includes('further');

    if (hasMoreWork) {
      return false;
    }

    const hasErrors = toolResults.some(r => !r.success);
    if (hasErrors) {
      return true;
    }

    return true;
  }

  private createExecutionContext(
    requestId: string,
    messages: Message[],
    overrides?: Partial<ExecutionContext>
  ): ExecutionContext {
    return {
      requestId,
      userId: overrides?.userId,
      sessionId: overrides?.sessionId,
      status: EXECUTION_STATUS.RUNNING,
      phase: EXECUTION_PHASES.INITIALIZATION,
      messages,
      variables: new Map(),
      toolCalls: [],
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      currentIteration: 0,
      metadata: {
        ...this.customContext,
        ...overrides?.metadata,
      },
      signal: overrides?.signal,
      ...overrides,
    };
  }

  private createSuccessResult(context: ExecutionContext): ExecutionResult {
    const finalMessage = context.messages[context.messages.length - 1];
    
    return {
      requestId: context.requestId,
      status: EXECUTION_STATUS.COMPLETED,
      output: finalMessage,
      messages: context.messages,
      toolCalls: context.toolCalls,
      toolResults: context.toolCalls.map(tc => ({
        callId: tc.id,
        name: tc.name,
        success: tc.status === TOOL_CALL_STATUS.COMPLETED,
        error: tc.error,
        timestamp: tc.completedAt || tc.createdAt,
      })),
      tokenUsage: context.tokenUsage,
      duration: Date.now() - context.createdAt,
      phases: this.aggregatePhases(context),
      cancelled: false,
      metadata: context.metadata,
    };
  }

  private createErrorResult(
    context: ExecutionContext,
    error: Error,
    duration: number
  ): ExecutionResult {
    return {
      requestId: context.requestId,
      status: EXECUTION_STATUS.FAILED,
      output: {
        role: 'assistant',
        content: `Error: ${error.message}`,
      },
      messages: context.messages,
      toolCalls: context.toolCalls,
      toolResults: [],
      tokenUsage: context.tokenUsage,
      duration,
      phases: this.aggregatePhases(context),
      error: {
        message: error.message,
        code: (error as any).code,
        stack: error.stack,
        recoverable: this.isRecoverableError(error),
      },
      cancelled: false,
      metadata: context.metadata,
    };
  }

  private createCancelledResult(context: ExecutionContext): ExecutionResult {
    return {
      requestId: context.requestId,
      status: EXECUTION_STATUS.CANCELLED,
      output: {
        role: 'assistant',
        content: 'Execution was cancelled',
      },
      messages: context.messages,
      toolCalls: context.toolCalls,
      toolResults: [],
      tokenUsage: context.tokenUsage,
      duration: Date.now() - context.createdAt,
      phases: this.aggregatePhases(context),
      cancelled: true,
      metadata: context.metadata,
    };
  }

  private aggregatePhases(context: ExecutionContext): Array<{
    phase: ExecutionPhase;
    startedAt: number;
    endedAt?: number;
    duration?: number;
  }> {
    return Object.entries(EXECUTION_PHASES)
      .filter(([key]) => key !== 'INITIALIZATION' && key !== 'FINALIZATION')
      .map(([key, value]) => ({
        phase: value as ExecutionPhase,
        startedAt: context.createdAt,
        endedAt: context.updatedAt,
        duration: context.updatedAt - context.createdAt,
      }));
  }

  private isRecoverableError(error: Error): boolean {
    const recoverablePatterns = [
      /timeout/i,
      /rate.?limit/i,
      /temporary/i,
      /network/i,
      /connection/i,
    ];

    return recoverablePatterns.some(pattern => pattern.test(error.message));
  }

  private normalizeInput(input: string | Message[]): Message[] {
    if (typeof input === 'string') {
      return [{ role: 'user', content: input }];
    }
    return input;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateMetrics(result: ExecutionResult, duration: number): void {
    this.metrics.totalExecutions++;
    
    if (result.status === EXECUTION_STATUS.COMPLETED) {
      this.metrics.successfulExecutions++;
    } else {
      this.metrics.failedExecutions++;
    }

    this.metrics.averageExecutionTime = 
      (this.metrics.averageExecutionTime * (this.metrics.totalExecutions - 1) + duration) /
      this.metrics.totalExecutions;

    if (result.tokenUsage) {
      this.metrics.averageTokenUsage = {
        inputTokens: Math.round(
          (this.metrics.averageTokenUsage.inputTokens * (this.metrics.totalExecutions - 1) + result.tokenUsage.inputTokens) /
          this.metrics.totalExecutions
        ),
        outputTokens: Math.round(
          (this.metrics.averageTokenUsage.outputTokens * (this.metrics.totalExecutions - 1) + result.tokenUsage.outputTokens) /
          this.metrics.totalExecutions
        ),
        totalTokens: Math.round(
          (this.metrics.averageTokenUsage.totalTokens * (this.metrics.totalExecutions - 1) + result.tokenUsage.totalTokens) /
          this.metrics.totalExecutions
        ),
      };
    }

    for (const toolCall of result.toolCalls) {
      const existing = this.metrics.toolCallStats.get(toolCall.name) || {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        averageDuration: 0,
      };

      existing.totalCalls++;
      if (toolCall.status === TOOL_CALL_STATUS.COMPLETED) {
        existing.successfulCalls++;
      } else {
        existing.failedCalls++;
      }

      this.metrics.toolCallStats.set(toolCall.name, existing);
    }
  }

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
    this.observability?.logger.info(`Tool registered: ${tool.name}`);
  }

  removeTool(name: string): boolean {
    const deleted = this.tools.delete(name);
    if (deleted) {
      this.observability?.logger.info(`Tool removed: ${name}`);
    }
    return deleted;
  }

  registerSkill(skill: Skill): void {
    this.skills.set(skill.id, skill);
    this.observability?.logger.info(`Skill registered: ${skill.name}`);
  }

  removeSkill(id: string): boolean {
    const deleted = this.skills.delete(id);
    if (deleted) {
      this.observability?.logger.info(`Skill removed: ${id}`);
    }
    return deleted;
  }

  addMiddleware(middleware: Middleware): void {
    this.middlewarePipeline.add(middleware);
  }

  removeMiddleware(name: string): void {
    this.middlewarePipeline.remove(name);
  }

  addObserver(observer: Observer): void {
    this.observers.push(observer);
  }

  removeObserver(name: string): void {
    this.observers = this.observers.filter(o => o.name !== name);
  }

  private async notifyObservers(
    method: keyof Observer,
    ...args: any[]
  ): Promise<void> {
    for (const observer of this.observers) {
      if (observer[method]) {
        try {
          await (observer[method] as Function)(...args);
        } catch (error) {
          this.observability?.logger.error(
            `Observer ${observer.name}.${method} failed`,
            { error }
          );
        }
      }
    }
  }

  async getState(): Promise<{
    status: 'idle' | 'running' | 'paused' | 'error';
    currentRequestId?: string;
    lastActiveAt: Date;
    error?: Error;
  }> {
    return {
      status: this.state.status,
      currentRequestId: this.state.currentRequestId,
      lastActiveAt: new Date(this.state.lastActiveAt),
      error: this.state.error,
    };
  }

  async reset(): Promise<void> {
    this.state.status = 'idle';
    this.state.currentRequestId = undefined;
    this.state.error = undefined;
    this.state.lastActiveAt = Date.now();

    this.observability?.logger.info('Agent state reset');
  }

  getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  getLogger(): Logger | undefined {
    return this.observability?.logger;
  }

  getMetricsCollector(): MetricsCollector | undefined {
    return this.observability?.metrics;
  }

  getTracer(): Tracer | undefined {
    return this.observability?.tracer;
  }

  getMonitor(): Monitor | undefined {
    return this.observability?.monitor;
  }

  getResilientClient(): ResilientClient | undefined {
    return this.resilientClient;
  }

  async cleanup(): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.cleanup) {
        await plugin.cleanup();
      }
    }

    for (const skill of this.skills.values()) {
      if (skill.cleanup) {
        await skill.cleanup();
      }
    }

    this.observability?.logger.info('Agent cleanup completed');
  }
}

export function createAgent(config: BaseAgentConfig): BaseAgent {
  return new (class extends BaseAgent {
    constructor(cfg: BaseAgentConfig) {
      super(cfg);
    }
  })(config);
}

export { AgentConfigType as AgentConfiguration };
