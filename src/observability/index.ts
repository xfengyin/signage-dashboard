export { Logger, LogLevel, LogContext, LogEntry, LogTransport, LoggerConfig, ConsoleTransport, FileTransport, RemoteTransport, createLogger, generateTraceId, generateSpanId } from './logger';

export { Tracer, TracerConfig, Span, SpanContext, SpanAttributes, TraceExporter, ToolCallTrace, SpanImpl, TracerImpl, ToolTracer, createTracer, createTraceContext } from './tracer';

export { MetricsCollector, Counter, Gauge, Histogram, MetricValue, Percentiles, HistogramSnapshot, CounterSnapshot, MetricExport, MetricsConfig, ToolCallMetric, AggregatedMetrics, createMetricsCollector } from './metrics';

export { Monitor, HealthStatus, HealthCheckResult, HealthCheck, PerformanceReport, ReportSummary, ReportMetrics, ReportTraces, HistogramStats, MonitorConfig, createMonitor, HealthCheckBuilder } from './monitor';

export interface ObservabilityConfig {
  serviceName: string;
  serviceVersion?: string;
  logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  enableConsoleTransport?: boolean;
  enableFileTransport?: boolean;
  logFilePath?: string;
  remoteLogEndpoint?: string;
  enableDefaultHealthChecks?: boolean;
  healthCheckInterval?: number;
  reportInterval?: number;
}

export interface Observability {
  logger: Logger;
  tracer: Tracer;
  metrics: MetricsCollector;
  monitor: Monitor;
}

export function initializeObservability(config: ObservabilityConfig): Observability {
  const { LogLevel, ConsoleTransport, createLogger } = require('./logger');
  const { createTracer } = require('./tracer');
  const { createMetricsCollector } = require('./metrics');
  const { createMonitor } = require('./monitor');

  const transports = [];
  
  if (config.enableConsoleTransport !== false) {
    transports.push(new ConsoleTransport());
  }

  let logger: Logger;
  if (config.enableFileTransport && config.logFilePath) {
    const { FileTransport } = require('./logger');
    transports.push(new FileTransport(config.logFilePath));
    logger = createLogger({
      level: config.logLevel as any || LogLevel.INFO,
      transports,
    });
  } else {
    logger = createLogger({
      level: config.logLevel as any || LogLevel.INFO,
      transports,
    });
  }

  if (config.remoteLogEndpoint) {
    const { RemoteTransport } = require('./logger');
    const remoteTransport = new RemoteTransport(config.remoteLogEndpoint);
    logger = createLogger({
      level: config.logLevel as any || LogLevel.INFO,
      transports: [...transports, remoteTransport],
    });
  }

  const tracer = createTracer({
    serviceName: config.serviceName,
    serviceVersion: config.serviceVersion || '1.0.0',
  });

  const metrics = createMetricsCollector({
    serviceName: config.serviceName,
    enableDefaultMetrics: true,
  });

  const monitor = createMonitor(logger, tracer, metrics, {
    serviceName: config.serviceName,
    serviceVersion: config.serviceVersion || '1.0.0',
    enableHealthChecks: config.enableDefaultHealthChecks !== false,
    healthCheckInterval: config.healthCheckInterval || 30000,
    reportInterval: config.reportInterval || 60000,
  });

  logger.info('Observability initialized', {
    serviceName: config.serviceName,
    serviceVersion: config.serviceVersion || '1.0.0',
  });

  return { logger, tracer, metrics, monitor };
}
