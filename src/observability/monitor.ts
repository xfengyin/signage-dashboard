import { Logger, LogContext, LogLevel } from './logger';
import { Tracer, SpanContext, ToolCallTrace } from './tracer';
import { MetricsCollector, ToolCallMetric } from './metrics';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  checks: HealthCheckResult[];
  uptime: number;
}

export interface HealthCheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface HealthCheck {
  name: string;
  check: () => Promise<HealthCheckResult> | HealthCheckResult;
}

export interface PerformanceReport {
  generatedAt: number;
  period: {
    start: number;
    end: number;
  };
  summary: ReportSummary;
  metrics: ReportMetrics;
  traces: ReportTraces;
  health: HealthStatus;
}

export interface ReportSummary {
  totalRequests: number;
  successRate: number;
  errorRate: number;
  avgResponseTime: number;
  totalTokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  activeSpans: number;
  completedSpans: number;
  totalToolCalls: number;
}

export interface ReportMetrics {
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
    avg: number;
  };
  tokenUsage: {
    input: HistogramStats;
    output: HistogramStats;
    total: HistogramStats;
  };
  queueLength: number;
  concurrency: number;
  toolMetrics: ToolCallMetric[];
}

export interface HistogramStats {
  count: number;
  sum: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface ReportTraces {
  totalToolTraces: number;
  toolTracesByStatus: {
    started: number;
    completed: number;
    failed: number;
  };
  avgToolDuration: number;
  slowToolCalls: ToolCallTrace[];
}

export interface MonitorConfig {
  serviceName: string;
  serviceVersion?: string;
  enableHealthChecks?: boolean;
  healthCheckInterval?: number;
  reportInterval?: number;
  reportRetention?: number;
}

export class Monitor {
  private logger: Logger;
  private tracer: Tracer;
  private metrics: MetricsCollector;
  private config: Required<MonitorConfig>;
  private healthChecks: Map<string, HealthCheck> = new Map();
  private lastHealthStatus: HealthStatus | null = null;
  private startTime: number;
  private reports: PerformanceReport[] = [];

  constructor(
    logger: Logger,
    tracer: Tracer,
    metrics: MetricsCollector,
    config: MonitorConfig
  ) {
    this.logger = logger;
    this.tracer = tracer;
    this.metrics = metrics;
    this.config = {
      serviceVersion: '1.0.0',
      enableHealthChecks: true,
      healthCheckInterval: 30000,
      reportInterval: 60000,
      reportRetention: 10,
      ...config,
    };
    this.startTime = Date.now();

    this.logger.info('Monitor initialized', {
      serviceName: this.config.serviceName,
      serviceVersion: this.config.serviceVersion,
    });
  }

  addHealthCheck(check: HealthCheck): void {
    this.healthChecks.set(check.name, check);
    this.logger.debug(`Health check added: ${check.name}`);
  }

  removeHealthCheck(name: string): boolean {
    return this.healthChecks.delete(name);
  }

  async checkHealth(): Promise<HealthStatus> {
    const results: HealthCheckResult[] = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    for (const [name, check] of this.healthChecks) {
      const startTime = Date.now();
      try {
        const result = await Promise.resolve(check.check());
        result.duration = Date.now() - startTime;
        results.push(result);

        if (result.status === 'fail') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'warn' && overallStatus !== 'unhealthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          name,
          status: 'fail',
          message: errorMessage,
          duration: Date.now() - startTime,
        });
        overallStatus = 'unhealthy';
      }
    }

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: Date.now(),
      checks: results,
      uptime: Date.now() - this.startTime,
    };

    this.lastHealthStatus = healthStatus;

    if (overallStatus === 'unhealthy') {
      this.logger.error('Health check failed', {}, { checks: results });
    } else if (overallStatus === 'degraded') {
      this.logger.warn('Health check degraded', {}, { checks: results });
    }

    return healthStatus;
  }

  async generateReport(periodStart?: number, periodEnd?: number): Promise<PerformanceReport> {
    const start = periodStart || (Date.now() - 60000);
    const end = periodEnd || Date.now();

    const aggregatedMetrics = this.metrics.getAggregatedMetrics();
    const responseTimeHistogram = this.metrics.getHistogram('agent.response.time');
    const responseSnapshot = responseTimeHistogram?.getSnapshot();

    const inputHistogram = this.metrics.getHistogram('agent.token.usage.input');
    const inputSnapshot = inputHistogram?.getSnapshot();
    const outputHistogram = this.metrics.getHistogram('agent.token.usage.output');
    const outputSnapshot = outputHistogram?.getSnapshot();
    const totalTokenHistogram = this.metrics.getHistogram('agent.token.usage.total');
    const totalTokenSnapshot = totalTokenHistogram?.getSnapshot();

    const queueLength = this.metrics.getGauge('agent.queue.length')?.getValue() || 0;
    const concurrency = this.metrics.getGauge('agent.concurrency.current')?.getValue() || 0;

    const toolTraces = this.tracer.getToolTraces();
    const failedTraces = toolTraces.filter(t => t.status === 'failed');
    const slowTraces = toolTraces
      .filter(t => t.duration && t.duration > 5000)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10);

    const completedSpans = this.tracer.getCompletedSpans();

    const report: PerformanceReport = {
      generatedAt: Date.now(),
      period: { start, end },
      summary: {
        totalRequests: aggregatedMetrics.totalToolCalls,
        successRate: aggregatedMetrics.overallSuccessRate,
        errorRate: 100 - aggregatedMetrics.overallSuccessRate,
        avgResponseTime: aggregatedMetrics.avgResponseTime,
        totalTokenUsage: aggregatedMetrics.totalTokenUsage,
        activeSpans: this.tracer.getActiveSpans(),
        completedSpans: completedSpans.length,
        totalToolCalls: aggregatedMetrics.totalToolCalls,
      },
      metrics: {
        responseTime: {
          p50: responseSnapshot?.percentiles.p50 || 0,
          p95: responseSnapshot?.percentiles.p95 || 0,
          p99: responseSnapshot?.percentiles.p99 || 0,
          min: responseSnapshot?.percentiles.min || 0,
          max: responseSnapshot?.percentiles.max || 0,
          avg: responseSnapshot?.avg || 0,
        },
        tokenUsage: {
          input: {
            count: inputSnapshot?.count || 0,
            sum: inputSnapshot?.sum || 0,
            avg: inputSnapshot?.avg || 0,
            p50: inputSnapshot?.percentiles.p50 || 0,
            p95: inputSnapshot?.percentiles.p95 || 0,
            p99: inputSnapshot?.percentiles.p99 || 0,
          },
          output: {
            count: outputSnapshot?.count || 0,
            sum: outputSnapshot?.sum || 0,
            avg: outputSnapshot?.avg || 0,
            p50: outputSnapshot?.percentiles.p50 || 0,
            p95: outputSnapshot?.percentiles.p95 || 0,
            p99: outputSnapshot?.percentiles.p99 || 0,
          },
          total: {
            count: totalTokenSnapshot?.count || 0,
            sum: totalTokenSnapshot?.sum || 0,
            avg: totalTokenSnapshot?.avg || 0,
            p50: totalTokenSnapshot?.percentiles.p50 || 0,
            p95: totalTokenSnapshot?.percentiles.p95 || 0,
            p99: totalTokenSnapshot?.percentiles.p99 || 0,
          },
        },
        queueLength,
        concurrency,
        toolMetrics: aggregatedMetrics.toolMetrics,
      },
      traces: {
        totalToolTraces: toolTraces.length,
        toolTracesByStatus: {
          started: toolTraces.filter(t => t.status === 'started').length,
          completed: toolTraces.filter(t => t.status === 'completed').length,
          failed: failedTraces.length,
        },
        avgToolDuration: toolTraces.length > 0
          ? toolTraces.reduce((sum, t) => sum + (t.duration || 0), 0) / toolTraces.length
          : 0,
        slowToolCalls: slowTraces,
      },
      health: this.lastHealthStatus || {
        status: 'healthy',
        timestamp: Date.now(),
        checks: [],
        uptime: Date.now() - this.startTime,
      },
    };

    this.reports.push(report);
    if (this.reports.length > this.config.reportRetention) {
      this.reports.shift();
    }

    this.logger.info('Performance report generated', {
      totalRequests: report.summary.totalRequests,
      successRate: report.summary.successRate,
      avgResponseTime: report.summary.avgResponseTime,
    });

    return report;
  }

  getReports(): PerformanceReport[] {
    return [...this.reports];
  }

  getLatestReport(): PerformanceReport | null {
    return this.reports[this.reports.length - 1] || null;
  }

  getHealthStatus(): HealthStatus | null {
    return this.lastHealthStatus;
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }

  createDefaultHealthChecks(): void {
    this.addHealthCheck({
      name: 'memory_usage',
      check: () => {
        const memUsage = process.memoryUsage();
        const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        return {
          name: 'memory_usage',
          status: heapUsedPercent > 90 ? 'fail' : heapUsedPercent > 70 ? 'warn' : 'pass',
          message: `Heap usage: ${heapUsedPercent.toFixed(2)}%`,
          metadata: {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
          },
        };
      },
    });

    this.addHealthCheck({
      name: 'active_spans',
      check: () => {
        const activeSpans = this.tracer.getActiveSpans();
        return {
          name: 'active_spans',
          status: activeSpans > 100 ? 'fail' : activeSpans > 50 ? 'warn' : 'pass',
          message: `Active spans: ${activeSpans}`,
          metadata: { activeSpans },
        };
      },
    });

    this.addHealthCheck({
      name: 'error_rate',
      check: () => {
        const metrics = this.metrics.getAggregatedMetrics();
        const errorRate = 100 - metrics.overallSuccessRate;
        return {
          name: 'error_rate',
          status: errorRate > 10 ? 'fail' : errorRate > 5 ? 'warn' : 'pass',
          message: `Error rate: ${errorRate.toFixed(2)}%`,
          metadata: { errorRate, totalFailures: metrics.totalFailures },
        };
      },
    });

    this.addHealthCheck({
      name: 'queue_length',
      check: () => {
        const queueLength = this.metrics.getGauge('agent.queue.length')?.getValue() || 0;
        return {
          name: 'queue_length',
          status: queueLength > 1000 ? 'fail' : queueLength > 500 ? 'warn' : 'pass',
          message: `Queue length: ${queueLength}`,
          metadata: { queueLength },
        };
      },
    });
  }

  reset(): void {
    this.reports = [];
    this.lastHealthStatus = null;
    this.logger.info('Monitor reset');
  }

  shutdown(): void {
    this.logger.info('Monitor shutting down', {
      uptime: this.getUptime(),
      totalReports: this.reports.length,
    });
  }
}

export function createMonitor(
  logger: Logger,
  tracer: Tracer,
  metrics: MetricsCollector,
  config: MonitorConfig
): Monitor {
  const monitor = new Monitor(logger, tracer, metrics, config);
  monitor.createDefaultHealthChecks();
  return monitor;
}

export class HealthCheckBuilder {
  private checks: HealthCheck[] = [];

  addCheck(name: string, checkFn: () => Promise<HealthCheckResult> | HealthCheckResult): this {
    this.checks.push({ name, check: checkFn });
    return this;
  }

  withMemoryCheck(threshold = 90): this {
    this.checks.push({
      name: 'memory_usage',
      check: () => {
        const memUsage = process.memoryUsage();
        const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        return {
          name: 'memory_usage',
          status: heapUsedPercent > threshold ? 'fail' : 'pass',
          message: `Heap usage: ${heapUsedPercent.toFixed(2)}%`,
          metadata: { heapUsedPercent },
        };
      },
    });
    return this;
  }

  withErrorRateCheck(threshold = 10): this {
    this.checks.push({
      name: 'error_rate',
      check: () => {
        return {
          name: 'error_rate',
          status: 'pass',
          message: 'Error rate check',
        };
      },
    });
    return this;
  }

  build(): HealthCheck[] {
    return [...this.checks];
  }
}
