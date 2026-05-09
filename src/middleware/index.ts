/**
 * @fileOverview 中间件导出 - 企业级Agent框架的统一中间件模块
 * @module middleware
 * @description 导出所有中间件模块，提供日志、指标、安全、缓存等中间件统一入口
 */

export { LoggerMiddleware, LoggerMiddlewareConfig, LogEntry, createLoggerMiddleware, createLogGroup, createConditionalLogger, createStructuredLogger } from './logger';

export { MetricsMiddleware, MetricsMiddlewareConfig, CustomMetricDefinition, createMetricsMiddleware, MetricsAggregator, MetricSnapshot, createMetricsAggregator, MetricsTimer, createMetricsTimer } from './metrics';

export { SecurityMiddleware, SecurityMiddlewareConfig, SecurityViolation, SecurityViolationType, SecurityValidator, ValidationResult, SecurityError, createSecurityMiddleware, createInputSanitizer, createOutputFilter } from './security';

export { CacheMiddleware, CacheMiddlewareConfig, RedisConfig, MemcachedConfig, CacheEntry, CacheStats, createCacheMiddleware, InMemoryCache, createInMemoryCache, LRUCache, LFUCache, createLFUCache } from './cache';

import { LoggerMiddleware, LoggerMiddlewareConfig } from './logger';
import { MetricsMiddleware, MetricsMiddlewareConfig } from './metrics';
import { SecurityMiddleware, SecurityMiddlewareConfig } from './security';
import { CacheMiddleware, CacheMiddlewareConfig } from './cache';

export interface MiddlewareConfig {
  logger?: LoggerMiddlewareConfig;
  metrics?: MetricsMiddlewareConfig;
  security?: SecurityMiddlewareConfig;
  cache?: CacheMiddlewareConfig;
}

export class MiddlewarePipeline implements Middleware {
  readonly name = 'MiddlewarePipeline';
  private middlewares: Array<{
    middleware: Middleware;
    priority: number;
  }>;

  constructor(middlewares: Middleware[] = []) {
    this.middlewares = middlewares.map(m => ({
      middleware: m,
      priority: m.priority,
    }));
    this.sort();
  }

  add(middleware: Middleware): this {
    this.middlewares.push({
      middleware,
      priority: middleware.priority,
    });
    this.sort();
    return this;
  }

  remove(name: string): this {
    this.middlewares = this.middlewares.filter(m => m.middleware.name !== name);
    return this;
  }

  private sort(): void {
    this.middlewares.sort((a, b) => b.priority - a.priority);
  }

  async handle(
    context: ExecutionContext,
    next: () => Promise<ExecutionResult>
  ): Promise<ExecutionResult> {
    let index = 0;

    const dispatch = async (i: number): Promise<ExecutionResult> => {
      if (i >= this.middlewares.length) {
        return next();
      }

      const { middleware } = this.middlewares[i];
      return middleware.handle(context, () => dispatch(i + 1));
    };

    return dispatch(0);
  }

  getMiddlewares(): Middleware[] {
    return this.middlewares.map(m => m.middleware);
  }

  getMiddlewareByName(name: string): Middleware | undefined {
    return this.middlewares.find(m => m.middleware.name === name)?.middleware;
  }
}

export function createMiddlewarePipeline(middlewares: Middleware[] = []): MiddlewarePipeline {
  return new MiddlewarePipeline(middlewares);
}

export function createDefaultMiddlewarePipeline(config?: MiddlewareConfig): MiddlewarePipeline {
  const pipeline = new MiddlewarePipeline();

  if (config?.security) {
    pipeline.add(new SecurityMiddleware(config.security));
  }

  if (config?.cache) {
    pipeline.add(new CacheMiddleware(config.cache));
  }

  if (config?.metrics) {
    pipeline.add(new MetricsMiddleware(config.metrics));
  }

  if (config?.logger) {
    pipeline.add(new LoggerMiddleware(config.logger));
  }

  return pipeline;
}

import type { ExecutionContext, ExecutionResult, Middleware } from '../core/interfaces';
