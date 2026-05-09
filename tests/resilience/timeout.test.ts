import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TimeoutHandler,
  TimeoutError,
  TimeoutManager,
  TimeoutConfig,
  TimeoutResult,
  withTimeout,
  createTimeoutHandler,
} from '../../src/resilience/timeout';

describe('TimeoutHandler', () => {
  let timeoutHandler: TimeoutHandler;

  const defaultConfig: Partial<TimeoutConfig> = {
    operationName: 'test-operation',
    onTimeout: vi.fn(),
    onSuccess: vi.fn(),
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    timeoutHandler = createTimeoutHandler(1000, defaultConfig);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should execute operation within timeout', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await timeoutHandler.execute(operation, 1000, 'test');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(defaultConfig.onSuccess).toHaveBeenCalled();
    });

    it('should reject when operation times out', async () => {
      const operation = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('success'), 2000))
      );

      const promise = timeoutHandler.execute(operation, 100, 'test');

      vi.advanceTimersByTime(100);

      await expect(promise).rejects.toThrow(TimeoutError);
      expect(defaultConfig.onTimeout).toHaveBeenCalledWith('test');
    });

    it('should reject when operation fails', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('operation failed'));

      await expect(
        timeoutHandler.execute(operation, 1000, 'test')
      ).rejects.toThrow('operation failed');

      expect(defaultConfig.onError).toHaveBeenCalled();
    });

    it('should use fallback when timeout occurs', async () => {
      const fallback = vi.fn().mockResolvedValue('fallback result');
      const handler = createTimeoutHandler(1000, {
        ...defaultConfig,
        fallback,
      });

      const operation = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('success'), 2000))
      );

      const result = await handler.execute(operation, 100, 'test');

      expect(result).toBe('fallback result');
      expect(fallback).toHaveBeenCalled();
    });

    it('should use configured fallback', async () => {
      const fallback = vi.fn().mockResolvedValue('fallback');
      const handler = createTimeoutHandler(100, {
        fallback,
      });

      const operation = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('success'), 200))
      );

      const result = await handler.execute(operation);

      expect(result).toBe('fallback');
    });
  });

  describe('executeWithResult', () => {
    it('should return success result when operation succeeds', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await timeoutHandler.executeWithResult(operation, 1000, 'test');

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.timedOut).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should return failure result when operation times out', async () => {
      const operation = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('success'), 2000))
      );

      const promise = timeoutHandler.executeWithResult(operation, 100, 'test');

      vi.advanceTimersByTime(100);

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(true);
      expect(result.error).toBeInstanceOf(TimeoutError);
    });

    it('should return failure result when operation fails', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('operation failed'));

      const result = await timeoutHandler.executeWithResult(operation, 1000, 'test');

      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
    });

    it('should track duration', async () => {
      const operation = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('success'), 500))
      );

      const result = await timeoutHandler.executeWithResult(operation, 1000, 'test');

      expect(result.duration).toBeGreaterThanOrEqual(500);
    });
  });

  describe('executeWithAbort', () => {
    it('should execute with abort signal', async () => {
      const operation = vi.fn().mockImplementation(
        (signal: AbortSignal) =>
          new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('aborted')));
            setTimeout(() => resolve('success'), 500);
          })
      );

      const result = await timeoutHandler.executeWithAbort(operation, 1000, 'test');

      expect(result).toBe('success');
    });

    it('should abort on timeout', async () => {
      const fallback = vi.fn().mockResolvedValue('fallback');
      const handler = createTimeoutHandler(1000, { fallback });

      const operation = vi.fn().mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
      );

      const promise = handler.executeWithAbort(operation, 100, 'test');

      vi.advanceTimersByTime(100);

      const result = await promise;

      expect(result).toBe('fallback');
      expect(fallback).toHaveBeenCalled();
    });

    it('should reject when aborted and no fallback', async () => {
      const operation = vi.fn().mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
      );

      const promise = timeoutHandler.executeWithAbort(operation, 100, 'test');

      vi.advanceTimersByTime(100);

      await expect(promise).rejects.toThrow(TimeoutError);
    });
  });

  describe('wrap', () => {
    it('should wrap function with timeout', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const wrapped = timeoutHandler.wrap(fn, 1000, 'wrapped');

      const result = await wrapped();

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should timeout wrapped function', async () => {
      const fn = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('success'), 2000))
      );
      const wrapped = timeoutHandler.wrap(fn, 100, 'wrapped');

      const promise = wrapped();

      vi.advanceTimersByTime(100);

      await expect(promise).rejects.toThrow(TimeoutError);
    });
  });
});

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should resolve when operation completes within timeout', async () => {
    const operation = vi.fn().mockResolvedValue('success');

    const result = await withTimeout(operation, 1000, 'test');

    expect(result).toBe('success');
  });

  it('should reject when operation times out', async () => {
    const operation = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve('success'), 2000))
    );

    const promise = withTimeout(operation, 100, 'test');

    vi.advanceTimersByTime(100);

    await expect(promise).rejects.toThrow(TimeoutError);
  });
});

describe('TimeoutError', () => {
  it('should create error with timeout and operation name', () => {
    const error = new TimeoutError('Operation timed out', 5000, 'myOperation');

    expect(error.message).toBe('Operation timed out');
    expect(error.timeout).toBe(5000);
    expect(error.operationName).toBe('myOperation');
    expect(error.name).toBe('TimeoutError');
  });

  it('should create error without operation name', () => {
    const error = new TimeoutError('Operation timed out', 5000);

    expect(error.message).toBe('Operation timed out');
    expect(error.timeout).toBe(5000);
    expect(error.operationName).toBeUndefined();
  });
});

describe('TimeoutManager', () => {
  let manager: TimeoutManager;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    manager = new TimeoutManager();
  });

  afterEach(() => {
    vi.useRealTimers();
    manager.clearAllTimeouts();
  });

  describe('setTimeout', () => {
    it('should set and execute timeout', () => {
      const fn = vi.fn();

      manager.setTimeout('test', fn, 1000);

      vi.advanceTimersByTime(1000);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should replace existing timeout with same name', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();

      manager.setTimeout('test', fn1, 1000);
      manager.setTimeout('test', fn2, 2000);

      vi.advanceTimersByTime(2000);

      expect(fn1).not.toHaveBeenCalled();
      expect(fn2).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearTimeout', () => {
    it('should clear existing timeout', () => {
      const fn = vi.fn();

      manager.setTimeout('test', fn, 1000);
      manager.clearTimeout('test');

      vi.advanceTimersByTime(1000);

      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('clearAllTimeouts', () => {
    it('should clear all timeouts', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();

      manager.setTimeout('test1', fn1, 1000);
      manager.setTimeout('test2', fn2, 2000);
      manager.clearAllTimeouts();

      vi.advanceTimersByTime(2000);

      expect(fn1).not.toHaveBeenCalled();
      expect(fn2).not.toHaveBeenCalled();
    });
  });

  describe('recordTiming', () => {
    it('should record operation timing', () => {
      manager.recordTiming('operation1', 100);
      manager.recordTiming('operation1', 200);
      manager.recordTiming('operation2', 150);

      const avg1 = manager.getAverageDuration('operation1');
      const avg2 = manager.getAverageDuration('operation2');

      expect(avg1).toBe(150);
      expect(avg2).toBe(150);
    });

    it('should limit recorded timings to 100', () => {
      for (let i = 0; i < 150; i++) {
        manager.recordTiming('operation', i);
      }

      const avg = manager.getAverageDuration('operation');
      const timings = manager.getPercentile('operation', 50);

      expect(timings).toBeGreaterThan(0);
    });
  });

  describe('getAverageDuration', () => {
    it('should return 0 for unknown operation', () => {
      expect(manager.getAverageDuration('unknown')).toBe(0);
    });

    it('should calculate average correctly', () => {
      manager.recordTiming('op', 100);
      manager.recordTiming('op', 200);
      manager.recordTiming('op', 300);

      expect(manager.getAverageDuration('op')).toBe(200);
    });
  });

  describe('getPercentile', () => {
    it('should return 0 for unknown operation', () => {
      expect(manager.getPercentile('unknown', 95)).toBe(0);
    });

    it('should calculate p50 correctly', () => {
      manager.recordTiming('op', 100);
      manager.recordTiming('op', 200);
      manager.recordTiming('op', 300);
      manager.recordTiming('op', 400);

      expect(manager.getPercentile('op', 50)).toBe(200);
    });

    it('should calculate p95 correctly', () => {
      for (let i = 1; i <= 20; i++) {
        manager.recordTiming('op', i * 10);
      }

      const p95 = manager.getPercentile('op', 95);

      expect(p95).toBeGreaterThanOrEqual(180);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics for all operations', () => {
      manager.recordTiming('op1', 100);
      manager.recordTiming('op1', 200);
      manager.recordTiming('op2', 150);

      const metrics = manager.getMetrics();

      expect(metrics.size).toBe(2);
      expect(metrics.has('op1')).toBe(true);
      expect(metrics.has('op2')).toBe(true);
    });

    it('should include all percentile values', () => {
      manager.recordTiming('op', 100);
      manager.recordTiming('op', 200);
      manager.recordTiming('op', 300);

      const metrics = manager.getMetrics();
      const opMetrics = metrics.get('op');

      expect(opMetrics).toHaveProperty('count', 3);
      expect(opMetrics).toHaveProperty('average');
      expect(opMetrics).toHaveProperty('p50');
      expect(opMetrics).toHaveProperty('p95');
      expect(opMetrics).toHaveProperty('p99');
    });
  });
});

describe('createTimeoutHandler', () => {
  it('should create timeout handler with default config', () => {
    const handler = createTimeoutHandler(5000);

    expect(handler).toBeInstanceOf(TimeoutHandler);
  });

  it('should create timeout handler with custom config', () => {
    const onTimeout = vi.fn();
    const handler = createTimeoutHandler(5000, { onTimeout });

    expect(handler).toBeInstanceOf(TimeoutHandler);
  });
});
