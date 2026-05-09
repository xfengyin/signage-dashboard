/**
 * @fileOverview 日志中间件 - Agent执行过程的日志记录中间件
 * @module middleware/logger
 * @description 提供统一的日志记录功能，支持多级别日志、日志分组、日志持久化等特性
 */

import type { ExecutionContext, ExecutionResult, Middleware } from '../core/interfaces';
import { Logger, LogLevel } from '../observability/logger';

export interface LoggerMiddlewareConfig {
  logger?: Logger;
  level?: 'debug' | 'info' | 'warn' | 'error';
  logExecution?: boolean;
  logToolCalls?: boolean;
  logToolResults?: boolean;
  logErrors?: boolean;
  logTiming?: boolean;
  logContext?: boolean;
  includeMetadata?: boolean;
  groupByExecution?: boolean;
  sensitiveFields?: string[];
  prettyPrint?: boolean;
}

export interface LogEntry {
  timestamp: number;
  level: string;
  message: string;
  executionId?: string;
  phase?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
  error?: Error;
}

export class LoggerMiddleware implements Middleware {
  readonly name = 'LoggerMiddleware';
  readonly priority: number;
  
  private logger: Logger;
  private config: Required<LoggerMiddlewareConfig>;
  private executionLogs: Map<string, LogEntry[]>;
  private currentExecution?: string;

  constructor(config: LoggerMiddlewareConfig = {}) {
    this.config = {
      logger: config.logger || this.createDefaultLogger(),
      level: config.level || 'info',
      logExecution: config.logExecution !== false,
      logToolCalls: config.logToolCalls !== false,
      logToolResults: config.logToolResults !== false,
      logErrors: config.logErrors !== false,
      logTiming: config.logTiming !== false,
      logContext: config.logContext !== false,
      includeMetadata: config.includeMetadata !== false,
      groupByExecution: config.groupByExecution !== true,
      sensitiveFields: config.sensitiveFields || ['password', 'token', 'apiKey', 'secret', 'authorization'],
      prettyPrint: config.prettyPrint !== false,
    };
    
    this.priority = config.logErrors ? 100 : 50;
    this.logger = this.config.logger;
    this.executionLogs = new Map();
  }

  private createDefaultLogger(): Logger {
    const { createLogger } = require('../observability/logger');
    return createLogger({
      level: this.config.level === 'debug' ? LogLevel.DEBUG : 
             this.config.level === 'info' ? LogLevel.INFO :
             this.config.level === 'warn' ? LogLevel.WARN : LogLevel.ERROR,
      transports: [new (require('../observability/logger').ConsoleTransport)()],
    });
  }

  async handle(
    context: ExecutionContext,
    next: () => Promise<ExecutionResult>
  ): Promise<ExecutionResult> {
    const executionId = context.requestId;
    const startTime = Date.now();
    
    this.currentExecution = executionId;
    
    if (this.config.groupByExecution) {
      this.executionLogs.set(executionId, []);
    }

    try {
      if (this.config.logExecution) {
        this.logExecutionStart(context);
      }

      const result = await next();

      if (this.config.logExecution) {
        const duration = Date.now() - startTime;
        this.logExecutionEnd(context, result, duration);
      }

      return result;
    } catch (error) {
      if (this.config.logErrors) {
        const duration = Date.now() - startTime;
        this.logExecutionError(context, error as Error, duration);
      }
      throw error;
    } finally {
      this.currentExecution = undefined;
    }
  }

  private logExecutionStart(context: ExecutionContext): void {
    const message = `Execution started: ${context.requestId}`;
    const logData = {
      requestId: context.requestId,
      userId: context.userId,
      sessionId: context.sessionId,
      phase: context.phase,
      iteration: context.currentIteration,
    };

    this.logger.info(message, this.sanitizeContext(logData));
  }

  private logExecutionEnd(
    context: ExecutionContext,
    result: ExecutionResult,
    duration: number
  ): void {
    const message = `Execution completed: ${context.requestId}`;
    const logData: Record<string, unknown> = {
      requestId: context.requestId,
      status: result.status,
      duration,
      toolCalls: result.toolCalls.length,
      tokenUsage: result.tokenUsage,
    };

    if (this.config.logTiming) {
      logData.phases = result.phases.map(p => ({
        phase: p.phase,
        duration: p.duration,
      }));
    }

    if (result.status === 'completed') {
      this.logger.info(message, this.sanitizeContext(logData));
    } else {
      this.logger.warn(message, this.sanitizeContext(logData));
    }
  }

  private logExecutionError(
    context: ExecutionContext,
    error: Error,
    duration: number
  ): void {
    const message = `Execution error: ${context.requestId}`;
    const logData = {
      requestId: context.requestId,
      status: 'failed',
      duration,
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
    };

    this.logger.error(message, this.sanitizeContext(logData), error);
  }

  logToolCall(
    toolName: string,
    params: unknown,
    context?: ExecutionContext
  ): void {
    if (!this.config.logToolCalls) return;

    const message = `Tool call: ${toolName}`;
    const logData: Record<string, unknown> = {
      toolName,
      params: this.sanitizeParams(params),
      requestId: context?.requestId,
      timestamp: Date.now(),
    };

    this.logger.debug(message, logData);
    this.addToExecutionLog('tool_call', logData);
  }

  logToolResult(
    toolName: string,
    result: unknown,
    context?: ExecutionContext
  ): void {
    if (!this.config.logToolResults) return;

    const message = `Tool result: ${toolName}`;
    const logData: Record<string, unknown> = {
      toolName,
      success: true,
      requestId: context?.requestId,
      timestamp: Date.now(),
    };

    this.logger.debug(message, logData);
    this.addToExecutionLog('tool_result', logData);
  }

  logToolError(
    toolName: string,
    error: Error,
    context?: ExecutionContext
  ): void {
    if (!this.config.logErrors) return;

    const message = `Tool error: ${toolName}`;
    const logData = {
      toolName,
      error: {
        message: error.message,
        name: error.name,
      },
      requestId: context?.requestId,
      timestamp: Date.now(),
    };

    this.logger.error(message, this.sanitizeContext(logData), error);
    this.addToExecutionLog('tool_error', logData);
  }

  logPhaseChange(
    oldPhase: string,
    newPhase: string,
    context?: ExecutionContext
  ): void {
    const message = `Phase changed: ${oldPhase} -> ${newPhase}`;
    const logData = {
      oldPhase,
      newPhase,
      requestId: context?.requestId,
      timestamp: Date.now(),
    };

    this.logger.debug(message, logData);
    this.addToExecutionLog('phase_change', logData);
  }

  logTokenUsage(usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  }, context?: ExecutionContext): void {
    if (!this.config.includeMetadata) return;

    const message = 'Token usage recorded';
    const logData = {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      requestId: context?.requestId,
      timestamp: Date.now(),
    };

    this.logger.debug(message, logData);
    this.addToExecutionLog('token_usage', logData);
  }

  private addToExecutionLog(
    type: string,
    data: Record<string, unknown>
  ): void {
    if (!this.config.groupByExecution || !this.currentExecution) return;

    const logs = this.executionLogs.get(this.currentExecution);
    if (logs) {
      logs.push({
        timestamp: Date.now(),
        level: 'info',
        message: type,
        metadata: data,
      });
    }
  }

  private sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (this.config.sensitiveFields.some(field => 
        key.toLowerCase().includes(field.toLowerCase())
      )) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeContext(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  private sanitizeParams(params: unknown): unknown {
    if (typeof params !== 'object' || params === null) {
      return params;
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
      if (this.config.sensitiveFields.some(field =>
        key.toLowerCase().includes(field.toLowerCase())
      )) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeParams(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  getExecutionLogs(executionId: string): LogEntry[] {
    return this.executionLogs.get(executionId) || [];
  }

  getAllExecutionIds(): string[] {
    return Array.from(this.executionLogs.keys());
  }

  clearExecutionLogs(executionId?: string): void {
    if (executionId) {
      this.executionLogs.delete(executionId);
    } else {
      this.executionLogs.clear();
    }
  }

  setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.config.level = level;
    this.logger.setLevel(
      level === 'debug' ? LogLevel.DEBUG :
      level === 'info' ? LogLevel.INFO :
      level === 'warn' ? LogLevel.WARN : LogLevel.ERROR
    );
  }

  addSensitiveField(field: string): void {
    if (!this.config.sensitiveFields.includes(field)) {
      this.config.sensitiveFields.push(field);
    }
  }

  removeSensitiveField(field: string): void {
    const index = this.config.sensitiveFields.indexOf(field);
    if (index > -1) {
      this.config.sensitiveFields.splice(index, 1);
    }
  }
}

export function createLoggerMiddleware(config?: LoggerMiddlewareConfig): LoggerMiddleware {
  return new LoggerMiddleware(config);
}

export function createLogGroup(name: string, logger: Logger): {
  log: (level: string, message: string, data?: Record<string, unknown>) => void;
  debug: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>, error?: Error) => void;
  group: <T>(fn: () => T) => T;
  groupAsync: <T>(fn: () => Promise<T>) => Promise<T>;
  end: () => void;
} {
  const logs: Array<{ timestamp: number; level: string; message: string; data?: Record<string, unknown> }> = [];
  const startTime = Date.now();

  return {
    log: (level, message, data) => {
      logs.push({ timestamp: Date.now(), level, message, data });
      logger.log(level as any, `[${name}] ${message}`, data);
    },
    debug: (message, data) => {
      logs.push({ timestamp: Date.now(), level: 'debug', message, data });
      logger.debug(`[${name}] ${message}`, data);
    },
    info: (message, data) => {
      logs.push({ timestamp: Date.now(), level: 'info', message, data });
      logger.info(`[${name}] ${message}`, data);
    },
    warn: (message, data) => {
      logs.push({ timestamp: Date.now(), level: 'warn', message, data });
      logger.warn(`[${name}] ${message}`, data);
    },
    error: (message, data, error) => {
      logs.push({ timestamp: Date.now(), level: 'error', message, data });
      logger.error(`[${name}] ${message}`, data, error);
    },
    group: (fn) => {
      const duration = Date.now() - startTime;
      logger.debug(`[${name}] Group started`, { duration: 0 });
      try {
        const result = fn();
        const finalDuration = Date.now() - startTime;
        logger.debug(`[${name}] Group completed`, { duration: finalDuration, logs: logs.length });
        return result;
      } catch (error) {
        const finalDuration = Date.now() - startTime;
        logger.error(`[${name}] Group failed`, { duration: finalDuration, error }, error as Error);
        throw error;
      }
    },
    groupAsync: async (fn) => {
      const duration = Date.now() - startTime;
      logger.debug(`[${name}] Async group started`, { duration: 0 });
      try {
        const result = await fn();
        const finalDuration = Date.now() - startTime;
        logger.debug(`[${name}] Async group completed`, { duration: finalDuration, logs: logs.length });
        return result;
      } catch (error) {
        const finalDuration = Date.now() - startTime;
        logger.error(`[${name}] Async group failed`, { duration: finalDuration, error }, error as Error);
        throw error;
      }
    },
    end: () => {
      const duration = Date.now() - startTime;
      logger.info(`[${name}] Log group ended`, {
        duration,
        logCount: logs.length,
        logs: logs.slice(-10),
      });
    },
  };
}

export function createConditionalLogger(
  logger: Logger,
  condition: (context?: Record<string, unknown>) => boolean,
  defaultData?: Record<string, unknown>
) {
  return {
    debug: (message: string, data?: Record<string, unknown>) => {
      if (condition(data)) {
        logger.debug(message, { ...defaultData, ...data });
      }
    },
    info: (message: string, data?: Record<string, unknown>) => {
      if (condition(data)) {
        logger.info(message, { ...defaultData, ...data });
      }
    },
    warn: (message: string, data?: Record<string, unknown>) => {
      if (condition(data)) {
        logger.warn(message, { ...defaultData, ...data });
      }
    },
    error: (message: string, data?: Record<string, unknown>, error?: Error) => {
      if (condition(data)) {
        logger.error(message, { ...defaultData, ...data }, error);
      }
    },
  };
}

export function createStructuredLogger(
  logger: Logger,
  defaultFields: Record<string, unknown>
) {
  return {
    debug: (message: string, fields?: Record<string, unknown>) => {
      logger.debug(message, { ...defaultFields, ...fields });
    },
    info: (message: string, fields?: Record<string, unknown>) => {
      logger.info(message, { ...defaultFields, ...fields });
    },
    warn: (message: string, fields?: Record<string, unknown>) => {
      logger.warn(message, { ...defaultFields, ...fields });
    },
    error: (message: string, fields?: Record<string, unknown>, error?: Error) => {
      logger.error(message, { ...defaultFields, ...fields }, error);
    },
    child: (additionalFields: Record<string, unknown>) => {
      return createStructuredLogger(logger, { ...defaultFields, ...additionalFields });
    },
  };
}
