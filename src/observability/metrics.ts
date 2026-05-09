export interface MetricValue {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface Percentiles {
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  avg: number;
}

export interface HistogramSnapshot {
  count: number;
  sum: number;
  percentiles: Percentiles;
}

export interface CounterSnapshot {
  value: number;
  labels: Record<string, string>;
}

export interface MetricExport {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  value: number | Percentiles;
  labels?: Record<string, string>;
  timestamp: number;
}

export class Counter {
  private value = 0;
  private labels: Record<string, string>;
  private history: MetricValue[] = [];
  private maxHistorySize: number;

  constructor(name: string, labels: Record<string, string> = {}, maxHistorySize = 1000) {
    this.name = name;
    this.labels = labels;
    this.maxHistorySize = maxHistorySize;
  }

  constructor(
    private name: string,
    labels: Record<string, string> = {},
    maxHistorySize = 1000
  ) {
    this.labels = labels;
    this.maxHistorySize = maxHistorySize;
  }

  increment(amount = 1, labels?: Record<string, string>): void {
    this.value += amount;
    this.history.push({
      value: this.value,
      timestamp: Date.now(),
      labels: labels || this.labels,
    });
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  getValue(): number {
    return this.value;
  }

  getSnapshot(): CounterSnapshot {
    return {
      value: this.value,
      labels: { ...this.labels },
    };
  }

  reset(): void {
    this.value = 0;
    this.history = [];
  }

  getHistory(): MetricValue[] {
    return [...this.history];
  }
}

export class Gauge {
  private value: number;
  private labels: Record<string, string>;
  private history: MetricValue[] = [];
  private maxHistorySize: number;

  constructor(
    private name: string,
    initialValue = 0,
    labels: Record<string, string> = {},
    maxHistorySize = 1000
  ) {
    this.value = initialValue;
    this.labels = labels;
    this.maxHistorySize = maxHistorySize;
  }

  set(value: number, labels?: Record<string, string>): void {
    this.value = value;
    this.history.push({
      value: this.value,
      timestamp: Date.now(),
      labels: labels || this.labels,
    });
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  increment(amount = 1, labels?: Record<string, string>): void {
    this.set(this.value + amount, labels);
  }

  decrement(amount = 1, labels?: Record<string, string>): void {
    this.set(this.value - amount, labels);
  }

  getValue(): number {
    return this.value;
  }

  getSnapshot(): { value: number; labels: Record<string, string> } {
    return {
      value: this.value,
      labels: { ...this.labels },
    };
  }

  reset(): void {
    this.value = 0;
    this.history = [];
  }

  getHistory(): MetricValue[] {
    return [...this.history];
  }
}

export class Histogram {
  private values: number[] = [];
  private labels: Record<string, string>;
  private maxSize: number;

  constructor(
    private name: string,
    labels: Record<string, string> = {},
    maxSize = 10000
  ) {
    this.labels = labels;
    this.maxSize = maxSize;
  }

  record(value: number, labels?: Record<string, string>): void {
    this.values.push(value);
    if (this.values.length > this.maxSize) {
      this.values.shift();
    }
  }

  getValues(): number[] {
    return [...this.values];
  }

  getSnapshot(): HistogramSnapshot {
    if (this.values.length === 0) {
      return {
        count: 0,
        sum: 0,
        percentiles: {
          p50: 0,
          p95: 0,
          p99: 0,
          min: 0,
          max: 0,
          avg: 0,
        },
      };
    }

    const sorted = [...this.values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    const percentile = (p: number): number => {
      const index = Math.ceil((p / 100) * count) - 1;
      return sorted[Math.max(0, index)];
    };

    return {
      count,
      sum,
      percentiles: {
        p50: percentile(50),
        p95: percentile(95),
        p99: percentile(99),
        min: sorted[0],
        max: sorted[count - 1],
        avg: sum / count,
      },
    };
  }

  reset(): void {
    this.values = [];
  }
}

export interface MetricsConfig {
  serviceName: string;
  enableDefaultMetrics?: boolean;
  percentiles?: number[];
}

export interface ToolCallMetric {
  toolName: string;
  callCount: number;
  successCount: number;
  failureCount: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  percentiles: Percentiles;
}

export interface AggregatedMetrics {
  totalToolCalls: number;
  totalSuccess: number;
  totalFailures: number;
  overallSuccessRate: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  totalTokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  toolMetrics: Map<string, ToolCallMetric>;
}

export class MetricsCollector {
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();
  private histograms: Map<string, Histogram> = new Map();
  private toolCallMetrics: Map<string, ToolCallMetric> = new Map();
  private tokenUsage: { input: number; output: number; total: number } = { input: 0, output: 0, total: 0 };
  private config: MetricsConfig;

  constructor(config: MetricsConfig) {
    this.config = {
      enableDefaultMetrics: true,
      percentiles: [50, 95, 99],
      ...config,
    };

    if (this.config.enableDefaultMetrics) {
      this.initializeDefaultMetrics();
    }
  }

  private initializeDefaultMetrics(): void {
    this.counter('agent.tool_calls.total', { service: this.config.serviceName });
    this.counter('agent.tool_calls.success', { service: this.config.serviceName });
    this.counter('agent.tool_calls.failure', { service: this.config.serviceName });
    this.counter('agent.requests.total', { service: this.config.serviceName });
    this.counter('agent.requests.success', { service: this.config.serviceName });
    this.counter('agent.requests.failure', { service: this.config.serviceName });
    
    this.gauge('agent.queue.length', 0, { service: this.config.serviceName });
    this.gauge('agent.concurrency.current', 0, { service: this.config.serviceName });
    this.gauge('agent.active_requests', 0, { service: this.config.serviceName });

    this.histogram('agent.response.time', { service: this.config.serviceName });
    this.histogram('agent.token.usage.input', { service: this.config.serviceName });
    this.histogram('agent.token.usage.output', { service: this.config.serviceName });
    this.histogram('agent.token.usage.total', { service: this.config.serviceName });
    this.histogram('agent.tool.duration', { service: this.config.serviceName });
  }

  counter(name: string, labels: Record<string, string> = {}): Counter {
    const key = this.getMetricKey(name, labels);
    if (!this.counters.has(key)) {
      this.counters.set(key, new Counter(name, labels));
    }
    return this.counters.get(key)!;
  }

  gauge(name: string, initialValue = 0, labels: Record<string, string> = {}): Gauge {
    const key = this.getMetricKey(name, labels);
    if (!this.gauges.has(key)) {
      this.gauges.set(key, new Gauge(name, initialValue, labels));
    }
    return this.gauges.get(key)!;
  }

  histogram(name: string, labels: Record<string, string> = {}): Histogram {
    const key = this.getMetricKey(name, labels);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, new Histogram(name, labels));
    }
    return this.histograms.get(key)!;
  }

  private getMetricKey(name: string, labels: Record<string, string>): string {
    const sortedLabels = Object.keys(labels)
      .sort()
      .map(k => `${k}=${labels[k]}`)
      .join(',');
    return `${name}{${sortedLabels}}`;
  }

  recordToolCall(
    toolName: string,
    duration: number,
    success: boolean,
    tokenUsage?: { input?: number; output?: number }
  ): void {
    const toolCounter = this.counter('agent.tool_calls.total');
    toolCounter.increment(1, { tool: toolName });

    const successCounter = this.counter('agent.tool_calls.success');
    const failureCounter = this.counter('agent.tool_calls.failure');

    if (success) {
      successCounter.increment(1, { tool: toolName });
    } else {
      failureCounter.increment(1, { tool: toolName });
    }

    this.histogram('agent.tool.duration').record(duration, { tool: toolName });

    if (tokenUsage) {
      if (tokenUsage.input) {
        this.histogram('agent.token.usage.input').record(tokenUsage.input, { tool: toolName });
        this.tokenUsage.input += tokenUsage.input;
      }
      if (tokenUsage.output) {
        this.histogram('agent.token.usage.output').record(tokenUsage.output, { tool: toolName });
        this.tokenUsage.output += tokenUsage.output;
      }
      const total = (tokenUsage.input || 0) + (tokenUsage.output || 0);
      if (total > 0) {
        this.histogram('agent.token.usage.total').record(total, { tool: toolName });
        this.tokenUsage.total += total;
      }
    }

    this.updateToolMetrics(toolName, duration, success, tokenUsage);
  }

  private updateToolMetrics(
    toolName: string,
    duration: number,
    success: boolean,
    tokenUsage?: { input?: number; output?: number }
  ): void {
    let metric = this.toolCallMetrics.get(toolName);
    
    if (!metric) {
      metric = {
        toolName,
        callCount: 0,
        successCount: 0,
        failureCount: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: duration,
        maxDuration: duration,
        percentiles: { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 },
      };
      this.toolCallMetrics.set(toolName, metric);
    }

    metric.callCount++;
    if (success) {
      metric.successCount++;
    } else {
      metric.failureCount++;
    }

    metric.totalDuration += duration;
    metric.avgDuration = metric.totalDuration / metric.callCount;
    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.maxDuration = Math.max(metric.maxDuration, duration);

    if (tokenUsage) {
      if (!metric.tokenUsage) {
        metric.tokenUsage = { input: 0, output: 0, total: 0 };
      }
      metric.tokenUsage.input += tokenUsage.input || 0;
      metric.tokenUsage.output += tokenUsage.output || 0;
      metric.tokenUsage.total += (tokenUsage.input || 0) + (tokenUsage.output || 0);
    }

    const durations = this.histogram('agent.tool.duration').getValues().filter((_, i) => i < 100);
    if (durations.length > 0) {
      const sorted = durations.sort((a, b) => a - b);
      const p50Idx = Math.floor(sorted.length * 0.5);
      const p95Idx = Math.floor(sorted.length * 0.95);
      const p99Idx = Math.floor(sorted.length * 0.99);
      
      metric.percentiles.p50 = sorted[p50Idx] || 0;
      metric.percentiles.p95 = sorted[p95Idx] || 0;
      metric.percentiles.p99 = sorted[p99Idx] || 0;
    }
  }

  recordResponseTime(duration: number, labels?: Record<string, string>): void {
    this.histogram('agent.response.time', labels).record(duration);
    this.counter('agent.requests.total').increment(1, labels);
  }

  recordSuccess(labels?: Record<string, string>): void {
    this.counter('agent.requests.success').increment(1, labels);
  }

  recordFailure(labels?: Record<string, string>): void {
    this.counter('agent.requests.failure').increment(1, labels);
  }

  setQueueLength(length: number): void {
    this.gauge('agent.queue.length').set(length);
  }

  setConcurrency(count: number): void {
    this.gauge('agent.concurrency.current').set(count);
  }

  incrementConcurrency(): number {
    const gauge = this.gauge('agent.concurrency.current');
    const current = gauge.getValue();
    gauge.set(current + 1);
    return current + 1;
  }

  decrementConcurrency(): number {
    const gauge = this.gauge('agent.concurrency.current');
    const current = gauge.getValue();
    gauge.set(Math.max(0, current - 1));
    return Math.max(0, current - 1);
  }

  recordTokenUsage(input: number, output: number): void {
    this.tokenUsage.input += input;
    this.tokenUsage.output += output;
    this.tokenUsage.total += input + output;

    if (input > 0) {
      this.histogram('agent.token.usage.input').record(input);
    }
    if (output > 0) {
      this.histogram('agent.token.usage.output').record(output);
    }
    if (input + output > 0) {
      this.histogram('agent.token.usage.total').record(input + output);
    }
  }

  getCounter(name: string, labels?: Record<string, string>): Counter | undefined {
    const key = this.getMetricKey(name, labels || {});
    return this.counters.get(key);
  }

  getGauge(name: string, labels?: Record<string, string>): Gauge | undefined {
    const key = this.getMetricKey(name, labels || {});
    return this.gauges.get(key);
  }

  getHistogram(name: string, labels?: Record<string, string>): Histogram | undefined {
    const key = this.getMetricKey(name, labels || {});
    return this.histograms.get(key);
  }

  getToolMetric(toolName: string): ToolCallMetric | undefined {
    return this.toolCallMetrics.get(toolName);
  }

  getAllToolMetrics(): ToolCallMetric[] {
    return Array.from(this.toolCallMetrics.values());
  }

  getAggregatedMetrics(): AggregatedMetrics {
    const toolMetrics: Map<string, ToolCallMetric> = new Map();
    let totalCalls = 0;
    let totalSuccess = 0;
    let totalFailures = 0;
    let totalDuration = 0;

    for (const [name, metric] of this.toolCallMetrics) {
      toolMetrics.set(name, { ...metric });
      totalCalls += metric.callCount;
      totalSuccess += metric.successCount;
      totalFailures += metric.failureCount;
      totalDuration += metric.totalDuration;
    }

    const responseTimeHistogram = this.histogram('agent.response.time');
    const responseSnapshot = responseTimeHistogram.getSnapshot();

    return {
      totalToolCalls: totalCalls,
      totalSuccess,
      totalFailures,
      overallSuccessRate: totalCalls > 0 ? (totalSuccess / totalCalls) * 100 : 0,
      avgResponseTime: responseSnapshot.avg,
      p50ResponseTime: responseSnapshot.percentiles.p50,
      p95ResponseTime: responseSnapshot.percentiles.p95,
      p99ResponseTime: responseSnapshot.percentiles.p99,
      totalTokenUsage: { ...this.tokenUsage },
      toolMetrics,
    };
  }

  export(): MetricExport[] {
    const exports: MetricExport[] = [];
    const timestamp = Date.now();

    for (const [key, counter] of this.counters) {
      const snapshot = counter.getSnapshot();
      exports.push({
        name: key.split('{')[0],
        type: 'counter',
        value: snapshot.value,
        labels: snapshot.labels,
        timestamp,
      });
    }

    for (const [key, gauge] of this.gauges) {
      const snapshot = gauge.getSnapshot();
      exports.push({
        name: key.split('{')[0],
        type: 'gauge',
        value: snapshot.value,
        labels: snapshot.labels,
        timestamp,
      });
    }

    for (const [key, histogram] of this.histograms) {
      const snapshot = histogram.getSnapshot();
      exports.push({
        name: key.split('{')[0],
        type: 'histogram',
        value: snapshot.percentiles,
        labels: histogram.getValues().length > 0 ? {} : undefined,
        timestamp,
      });
    }

    return exports;
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.toolCallMetrics.clear();
    this.tokenUsage = { input: 0, output: 0, total: 0 };

    if (this.config.enableDefaultMetrics) {
      this.initializeDefaultMetrics();
    }
  }
}

export function createMetricsCollector(config: MetricsConfig): MetricsCollector {
  return new MetricsCollector(config);
}
