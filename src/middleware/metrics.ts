/**
 * @fileOverview 指标中间件 - Agent执行过程的性能指标收集中间件
 * @module middleware/metrics
 * @description 提供统一的指标收集功能，包括执行时间、工具调用次数、Token使用量等指标
 */

import type { ExecutionContext, ExecutionResult, Middleware } from '../core/interfaces';
import { MetricsCollector, MetricValue, ToolCallMetric } from '../observability/metrics';

export interface MetricsMiddlewareConfig {
  metrics?: MetricsCollector;
  trackExecutionTime?: boolean;
  trackToolCalls?: boolean;
  trackTokenUsage?: boolean;
  trackPhaseTransitions?: boolean;
  trackErrors?: boolean;
  trackConcurrent?: boolean;
  aggregationWindow?: number;
  customMetrics?: CustomMetricDefinition[];
}

export interface CustomMetricDefinition {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  description?: string;
  labels?: string[];
  buckets?: number[];
}

export class MetricsMiddleware implements Middleware {
  readonly name = 'MetricsMiddleware';
  readonly priority: number;
  
  private metrics: MetricsCollector;
  private config: Required<MetricsMiddlewareConfig>;
  private activeExecutions: Map<string, number>;
  private startTimes: Map<string, number>;

  constructor(config: MetricsMiddlewareConfig = {}) {
    this.config = {
      metrics: config.metrics || this.createDefaultMetrics(),
      trackExecutionTime: config.trackExecutionTime !== false,
      trackToolCalls: config.trackToolCalls !== false,
      trackTokenUsage: config.trackTokenUsage !== false,
      trackPhaseTransitions: config.trackPhaseTransitions !== false,
      trackErrors: config.trackErrors !== false,
      trackConcurrent: config.trackConcurrent !== false,
      aggregationWindow: config.aggregationWindow || 60000,
      customMetrics: config.customMetrics || [],
    };
    
    this.priority = config.trackErrors ? 90 : 40;
    this.metrics = this.config.metrics;
    this.activeExecutions = new Map();
    this.startTimes = new Map();
    
    this.initializeCustomMetrics();
  }

  private createDefaultMetrics(): MetricsCollector {
    const { createMetricsCollector } = require('../observability/metrics');
    return createMetricsCollector({
      serviceName: 'agent-framework',
      enableDefaultMetrics: true,
    });
  }

  private initializeCustomMetrics(): void {
    for (const metric of this.config.customMetrics) {
      if (metric.type === 'counter') {
        this.metrics.counter(metric.name, metric.description || '');
      } else if (metric.type === 'gauge') {
        this.metrics.gauge(metric.name, metric.description || '');
      } else if (metric.type === 'histogram') {
        this.metrics.histogram(metric.name, metric.description || '', metric.buckets);
      }
    }
  }

  async handle(
    context: ExecutionContext,
    next: () => Promise<ExecutionResult>
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const requestId = context.requestId;
    
    this.startTimes.set(requestId, startTime);
    
    if (this.config.trackConcurrent) {
      this.metrics.increment('agent_executions_active');
      this.activeExecutions.set(requestId, Date.now());
    }

    try {
      const result = await next();
      const duration = Date.now() - startTime;

      if (this.config.trackExecutionTime) {
        this.recordExecutionMetrics(requestId, result, duration);
      }

      if (this.config.trackTokenUsage) {
        this.recordTokenMetrics(result.tokenUsage);
      }

      return result;
    } catch (error) {
      if (this.config.trackErrors) {
        this.recordErrorMetrics(requestId, error as Error);
      }
      throw error;
    } finally {
      if (this.config.trackConcurrent) {
        this.metrics.decrement('agent_executions_active');
        this.activeExecutions.delete(requestId);
      }
      this.startTimes.delete(requestId);
    }
  }

  private recordExecutionMetrics(
    requestId: string,
    result: ExecutionResult,
    duration: number
  ): void {
    const labels = {
      status: result.status,
      cancelled: String(result.cancelled),
    };

    this.metrics.histogram(
      'execution_duration_ms',
      'Execution duration in milliseconds',
      [100, 500, 1000, 5000, 10000, 30000, 60000, 120000, 300000]
    ).record(duration, labels);

    this.metrics.counter(
      'agent_executions_total',
      'Total number of agent executions'
    ).increment(labels);

    this.metrics.gauge(
      'agent_executions_last_duration_ms',
      'Last execution duration in milliseconds'
    ).set(duration, labels);

    for (const phase of result.phases) {
      if (phase.duration) {
        this.metrics.histogram(
          'phase_duration_ms',
          'Phase duration in milliseconds',
          [10, 50, 100, 500, 1000, 5000]
        ).record(phase.duration, { phase: phase.phase });
      }
    }
  }

  private recordTokenMetrics(usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  }): void {
    this.metrics.counter(
      'token_usage_total',
      'Total token usage'
    ).incrementBy(usage.totalTokens, { type: 'total' });

    this.metrics.counter(
      'token_usage_total',
      'Input token usage'
    ).incrementBy(usage.inputTokens, { type: 'input' });

    this.metrics.counter(
      'token_usage_total',
      'Output token usage'
    ).incrementBy(usage.outputTokens, { type: 'output' });

    this.metrics.gauge(
      'token_usage_last',
      'Last execution token usage'
    ).set(usage.totalTokens);
  }

  private recordToolMetrics(
    toolName: string,
    duration: number,
    success: boolean,
    error?: string
  ): void {
    const labels = {
      tool: toolName,
      status: success ? 'success' : 'error',
      error: error || 'none',
    };

    this.metrics.counter(
      'tool_calls_total',
      'Total number of tool calls'
    ).increment(labels);

    this.metrics.histogram(
      'tool_duration_ms',
      'Tool execution duration in milliseconds',
      [10, 50, 100, 500, 1000, 5000, 10000, 30000]
    ).record(duration, { tool: toolName });
  }

  private recordErrorMetrics(requestId: string, error: Error): void {
    const labels = {
      error_type: error.name || 'Error',
      error_code: (error as any).code || 'UNKNOWN',
    };

    this.metrics.counter(
      'execution_errors_total',
      'Total number of execution errors'
    ).increment(labels);
  }

  recordToolCall(
    toolName: string,
    duration: number,
    success: boolean,
    error?: string
  ): void {
    if (!this.config.trackToolCalls) return;
    this.recordToolMetrics(toolName, duration, success, error);
  }

  recordPhaseTransition(
    oldPhase: string,
    newPhase: string
  ): void {
    if (!this.config.trackPhaseTransitions) return;

    this.metrics.counter(
      'phase_transitions_total',
      'Total number of phase transitions'
    ).increment({
      from_phase: oldPhase,
      to_phase: newPhase,
    });
  }

  recordCustomMetric(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    const metric = this.metrics.gauge(name);
    if (metric) {
      metric.set(value, labels);
    }
  }

  incrementCustomCounter(
    name: string,
    labels?: Record<string, string>
  ): void {
    const metric = this.metrics.counter(name);
    if (metric) {
      metric.increment(labels);
    }
  }

  recordCustomHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    const metric = this.metrics.histogram(name);
    if (metric) {
      metric.record(value, labels);
    }
  }

  getMetrics(): MetricsCollector {
    return this.metrics;
  }

  getActiveExecutionsCount(): number {
    return this.activeExecutions.size;
  }

  getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys());
  }

  async getMetricsSnapshot(): Promise<{
    counters: Record<string, MetricValue>;
    gauges: Record<string, MetricValue>;
    histograms: Record<string, any>;
    activeExecutions: number;
    uptime: number;
  }> {
    const snapshot = await this.metrics.export();
    
    return {
      ...snapshot,
      activeExecutions: this.activeExecutions.size,
      uptime: Date.now() - (this.startTimes.get('system_start') || Date.now()),
    };
  }

  reset(): void {
    this.activeExecutions.clear();
    this.startTimes.clear();
  }
}

export function createMetricsMiddleware(config?: MetricsMiddlewareConfig): MetricsMiddleware {
  return new MetricsMiddleware(config);
}

export class MetricsAggregator {
  private metrics: Map<string, MetricSnapshot> = new Map();

  record(
    name: string,
    value: number,
    timestamp: number = Date.now()
  ): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        name,
        values: [],
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        avg: 0,
      });
    }

    const snapshot = this.metrics.get(name)!;
    snapshot.values.push({ value, timestamp });
    snapshot.count++;
    snapshot.sum += value;
    snapshot.min = Math.min(snapshot.min, value);
    snapshot.max = Math.max(snapshot.max, value);
    snapshot.avg = snapshot.sum / snapshot.count;
  }

  get(name: string): MetricSnapshot | undefined {
    return this.metrics.get(name);
  }

  getAll(): Map<string, MetricSnapshot> {
    return this.metrics;
  }

  clear(): void {
    this.metrics.clear();
  }
}

export interface MetricSnapshot {
  name: string;
  values: Array<{ value: number; timestamp: number }>;
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
}

export function createMetricsAggregator(): MetricsAggregator {
  return new MetricsAggregator();
}

export class MetricsTimer {
  private startTime: number;
  private labels: Record<string, string>;

  constructor(labels: Record<string, string> = {}) {
    this.startTime = Date.now();
    this.labels = labels;
  }

  end(metrics: MetricsCollector | MetricsMiddleware): number {
    const duration = Date.now() - this.startTime;
    
    if (metrics instanceof MetricsMiddleware) {
      metrics.recordCustomHistogram('custom_timer', duration, this.labels);
    } else {
      metrics.histogram('custom_timer', 'Custom timer duration').record(duration, this.labels);
    }
    
    return duration;
  }

  getDuration(): number {
    return Date.now() - this.startTime;
  }

  reset(): void {
    this.startTime = Date.now();
  }
}

export function createMetricsTimer(labels?: Record<string, string>): MetricsTimer {
  return new MetricsTimer(labels);
}
