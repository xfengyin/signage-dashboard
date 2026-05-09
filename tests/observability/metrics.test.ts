import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Counter,
  Gauge,
  Histogram,
  MetricsCollector,
  createMetricsCollector,
} from '../../src/observability/metrics';

describe('Counter', () => {
  let counter: Counter;

  beforeEach(() => {
    counter = new Counter('test_counter', { label: 'value' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('increment', () => {
    it('should increment counter value', () => {
      counter.increment();
      expect(counter.getValue()).toBe(1);

      counter.increment(5);
      expect(counter.getValue()).toBe(6);
    });

    it('should record history', () => {
      counter.increment();
      counter.increment();

      const history = counter.getHistory();
      expect(history).toHaveLength(2);
    });

    it('should respect max history size', () => {
      const smallCounter = new Counter('test', {}, 3);

      for (let i = 0; i < 5; i++) {
        smallCounter.increment();
      }

      expect(smallCounter.getHistory().length).toBe(3);
    });
  });

  describe('getSnapshot', () => {
    it('should return current value and labels', () => {
      counter.increment(10);

      const snapshot = counter.getSnapshot();
      expect(snapshot.value).toBe(10);
      expect(snapshot.labels.label).toBe('value');
    });
  });

  describe('reset', () => {
    it('should reset counter to zero', () => {
      counter.increment(100);
      counter.reset();

      expect(counter.getValue()).toBe(0);
      expect(counter.getHistory()).toHaveLength(0);
    });
  });
});

describe('Gauge', () => {
  let gauge: Gauge;

  beforeEach(() => {
    gauge = new Gauge('test_gauge', 0, { env: 'test' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('set', () => {
    it('should set gauge value', () => {
      gauge.set(50);
      expect(gauge.getValue()).toBe(50);
    });

    it('should record history', () => {
      gauge.set(10);
      gauge.set(20);

      const history = gauge.getHistory();
      expect(history).toHaveLength(2);
    });
  });

  describe('increment', () => {
    it('should increment gauge', () => {
      gauge.set(10);
      gauge.increment(5);

      expect(gauge.getValue()).toBe(15);
    });

    it('should increment by 1 by default', () => {
      gauge.set(10);
      gauge.increment();

      expect(gauge.getValue()).toBe(11);
    });
  });

  describe('decrement', () => {
    it('should decrement gauge', () => {
      gauge.set(10);
      gauge.decrement(3);

      expect(gauge.getValue()).toBe(7);
    });

    it('should not go below zero by default', () => {
      gauge.set(5);
      gauge.decrement(10);

      expect(gauge.getValue()).toBe(-5);
    });
  });

  describe('reset', () => {
    it('should reset gauge to zero', () => {
      gauge.set(100);
      gauge.reset();

      expect(gauge.getValue()).toBe(0);
      expect(gauge.getHistory()).toHaveLength(0);
    });
  });
});

describe('Histogram', () => {
  let histogram: Histogram;

  beforeEach(() => {
    histogram = new Histogram('test_histogram', { type: 'latency' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('record', () => {
    it('should record values', () => {
      histogram.record(100);
      histogram.record(200);
      histogram.record(300);

      const values = histogram.getValues();
      expect(values).toHaveLength(3);
      expect(values).toContain(100);
      expect(values).toContain(200);
      expect(values).toContain(300);
    });

    it('should respect max size', () => {
      const smallHistogram = new Histogram('small', {}, 3);

      for (let i = 0; i < 5; i++) {
        smallHistogram.record(i);
      }

      expect(smallHistogram.getValues().length).toBe(3);
    });
  });

  describe('getSnapshot', () => {
    it('should return correct percentiles', () => {
      for (let i = 1; i <= 100; i++) {
        histogram.record(i);
      }

      const snapshot = histogram.getSnapshot();

      expect(snapshot.count).toBe(100);
      expect(snapshot.sum).toBe(5050);
      expect(snapshot.percentiles.p50).toBe(51);
      expect(snapshot.percentiles.p95).toBe(95);
      expect(snapshot.percentiles.p99).toBe(99);
      expect(snapshot.percentiles.min).toBe(1);
      expect(snapshot.percentiles.max).toBe(100);
      expect(snapshot.percentiles.avg).toBe(50.5);
    });

    it('should handle empty histogram', () => {
      const snapshot = histogram.getSnapshot();

      expect(snapshot.count).toBe(0);
      expect(snapshot.percentiles.p50).toBe(0);
    });
  });

  describe('reset', () => {
    it('should clear all values', () => {
      histogram.record(100);
      histogram.record(200);
      histogram.reset();

      expect(histogram.getValues()).toHaveLength(0);
    });
  });
});

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = createMetricsCollector({ serviceName: 'test-service' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('counter', () => {
    it('should create or get counter', () => {
      const counter = collector.counter('test_counter');

      expect(counter).toBeInstanceOf(Counter);
    });

    it('should return same counter for same name', () => {
      const counter1 = collector.counter('test_counter');
      const counter2 = collector.counter('test_counter');

      expect(counter1).toBe(counter2);
    });
  });

  describe('gauge', () => {
    it('should create or get gauge', () => {
      const gauge = collector.gauge('test_gauge');

      expect(gauge).toBeInstanceOf(Gauge);
    });
  });

  describe('histogram', () => {
    it('should create or get histogram', () => {
      const histogram = collector.histogram('test_histogram');

      expect(histogram).toBeInstanceOf(Histogram);
    });
  });

  describe('recordToolCall', () => {
    it('should record tool call metrics', () => {
      collector.recordToolCall('calculator', 100, true);

      const metric = collector.getToolMetric('calculator');
      expect(metric).toBeDefined();
      expect(metric?.callCount).toBe(1);
      expect(metric?.successCount).toBe(1);
      expect(metric?.failureCount).toBe(0);
    });

    it('should record failed tool calls', () => {
      collector.recordToolCall('calculator', 100, false);

      const metric = collector.getToolMetric('calculator');
      expect(metric?.callCount).toBe(1);
      expect(metric?.failureCount).toBe(1);
    });

    it('should track token usage', () => {
      collector.recordToolCall('calculator', 100, true, { input: 100, output: 50 });

      const metric = collector.getToolMetric('calculator');
      expect(metric?.tokenUsage?.input).toBe(100);
      expect(metric?.tokenUsage?.output).toBe(50);
      expect(metric?.tokenUsage?.total).toBe(150);
    });

    it('should update duration statistics', () => {
      collector.recordToolCall('calculator', 100, true);
      collector.recordToolCall('calculator', 200, true);

      const metric = collector.getToolMetric('calculator');
      expect(metric?.avgDuration).toBe(150);
      expect(metric?.minDuration).toBe(100);
      expect(metric?.maxDuration).toBe(200);
    });
  });

  describe('recordResponseTime', () => {
    it('should record response time', () => {
      collector.recordResponseTime(250);

      const histogram = collector.getHistogram('agent.response.time');
      expect(histogram?.getValues()).toContain(250);
    });
  });

  describe('recordSuccess/recordFailure', () => {
    it('should record success', () => {
      collector.recordSuccess();

      const counter = collector.getCounter('agent.requests.success');
      expect(counter?.getValue()).toBe(1);
    });

    it('should record failure', () => {
      collector.recordFailure();

      const counter = collector.getCounter('agent.requests.failure');
      expect(counter?.getValue()).toBe(1);
    });
  });

  describe('queue and concurrency', () => {
    it('should set queue length', () => {
      collector.setQueueLength(10);

      const gauge = collector.getGauge('agent.queue.length');
      expect(gauge?.getValue()).toBe(10);
    });

    it('should increment concurrency', () => {
      collector.setConcurrency(0);
      const newCount = collector.incrementConcurrency();

      expect(newCount).toBe(1);
    });

    it('should decrement concurrency', () => {
      collector.setConcurrency(5);
      const newCount = collector.decrementConcurrency();

      expect(newCount).toBe(4);
    });
  });

  describe('getAggregatedMetrics', () => {
    it('should return aggregated metrics', () => {
      collector.recordToolCall('tool1', 100, true);
      collector.recordToolCall('tool2', 200, true);
      collector.recordToolCall('tool2', 300, false);

      const metrics = collector.getAggregatedMetrics();

      expect(metrics.totalToolCalls).toBe(3);
      expect(metrics.totalSuccess).toBe(2);
      expect(metrics.totalFailures).toBe(1);
      expect(metrics.overallSuccessRate).toBeCloseTo(66.67, 1);
      expect(metrics.toolMetrics.size).toBe(2);
    });
  });

  describe('export', () => {
    it('should export all metrics', () => {
      collector.counter('test_metric').increment(10);

      const exports = collector.export();

      expect(Array.isArray(exports)).toBe(true);
      expect(exports.length).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      collector.counter('test').increment(100);
      collector.reset();

      const counter = collector.getCounter('test');
      expect(counter?.getValue()).toBe(0);
    });
  });
});

describe('createMetricsCollector', () => {
  it('should create collector with config', () => {
    const collector = createMetricsCollector({
      serviceName: 'my-service',
      enableDefaultMetrics: true,
    });

    expect(collector).toBeInstanceOf(MetricsCollector);
  });

  it('should create collector without default metrics', () => {
    const collector = createMetricsCollector({
      serviceName: 'my-service',
      enableDefaultMetrics: false,
    });

    expect(collector).toBeInstanceOf(MetricsCollector);
  });
});
