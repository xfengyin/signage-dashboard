import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RetryHandler,
  RetryCalculator,
  RetryBuilder,
  RetryConfig,
  BackoffStrategy,
  RetryError,
  CircuitBreakerOpenError,
  isRetryableError,
  DEFAULT_RETRY_CONFIG,
  CircuitState,
} from '../../src/resilience/retry';

describe('RetryCalculator', () => {
  describe('calculateDelay', () => {
    it('should calculate fixed delay', () => {
      const config: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 1000,
        backoff: BackoffStrategy.FIXED,
      };

      expect(RetryCalculator.calculateDelay(1, config)).toBe(1000);
      expect(RetryCalculator.calculateDelay(2, config)).toBe(1000);
      expect(RetryCalculator.calculateDelay(3, config)).toBe(1000);
    });

    it('should calculate linear delay', () => {
      const config: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 1000,
        backoff: BackoffStrategy.LINEAR,
      };

      expect(RetryCalculator.calculateDelay(1, config)).toBe(1000);
      expect(RetryCalculator.calculateDelay(2, config)).toBe(2000);
      expect(RetryCalculator.calculateDelay(3, config)).toBe(3000);
    });

    it('should calculate exponential delay', () => {
      const config: RetryConfig = {
        maxAttempts: 5,
        initialDelay: 1000,
        backoff: BackoffStrategy.EXPONENTIAL,
      };

      expect(RetryCalculator.calculateDelay(1, config)).toBe(1000);
      expect(RetryCalculator.calculateDelay(2, config)).toBe(2000);
      expect(RetryCalculator.calculateDelay(3, config)).toBe(4000);
      expect(RetryCalculator.calculateDelay(4, config)).toBe(8000);
    });

    it('should calculate fibonacci delay', () => {
      const config: RetryConfig = {
        maxAttempts: 5,
        initialDelay: 1000,
        backoff: BackoffStrategy.FIBONACCI,
      };

      expect(RetryCalculator.calculateDelay(1, config)).toBe(1000);
      expect(RetryCalculator.calculateDelay(2, config)).toBe(1000);
      expect(RetryCalculator.calculateDelay(3, config)).toBe(2000);
      expect(RetryCalculator.calculateDelay(4, config)).toBe(3000);
      expect(RetryCalculator.calculateDelay(5, config)).toBe(5000);
    });

    it('should respect maxDelay', () => {
      const config: RetryConfig = {
        maxAttempts: 5,
        initialDelay: 1000,
        maxDelay: 5000,
        backoff: BackoffStrategy.EXPONENTIAL,
      };

      expect(RetryCalculator.calculateDelay(1, config)).toBe(1000);
      expect(RetryCalculator.calculateDelay(2, config)).toBe(2000);
      expect(RetryCalculator.calculateDelay(3, config)).toBe(4000);
      expect(RetryCalculator.calculateDelay(4, config)).toBe(5000);
      expect(RetryCalculator.calculateDelay(5, config)).toBe(5000);
    });

    it('should add jitter when enabled', () => {
      vi.useFakeTimers();
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const config: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 1000,
        backoff: BackoffStrategy.EXPONENTIAL,
        jitter: true,
        jitterFactor: 0.5,
      };

      const delay = RetryCalculator.calculateDelay(2, config);

      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThanOrEqual(3000);

      vi.useRealTimers();
    });
  });
});

describe('RetryHandler', () => {
  let retryHandler: RetryHandler;

  beforeEach(() => {
    retryHandler = new RetryHandler({
      maxAttempts: 3,
      initialDelay: 100,
      backoff: BackoffStrategy.FIXED,
    });
  });

  describe('execute', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await retryHandler.execute(operation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      vi.useFakeTimers();

      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('error 1'))
        .mockRejectedValueOnce(new Error('error 2'))
        .mockResolvedValue('success');

      const promise = retryHandler.execute(operation);

      vi.advanceTimersByTime(100);
      await Promise.resolve();
      vi.advanceTimersByTime(100);

      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(result.result).toBe('success');

      vi.useRealTimers();
    });

    it('should fail after max attempts', async () => {
      vi.useFakeTimers();

      const operation = vi.fn().mockRejectedValue(new Error('persistent error'));

      const promise = retryHandler.execute(operation);

      vi.advanceTimersByTime(300);

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.attempts).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });

    it('should trigger onRetry callback', async () => {
      vi.useFakeTimers();

      const onRetry = vi.fn();
      const handler = new RetryHandler({
        maxAttempts: 3,
        initialDelay: 100,
        backoff: BackoffStrategy.FIXED,
        onRetry,
      });

      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('error'))
        .mockResolvedValue('success');

      const promise = handler.execute(operation);

      vi.advanceTimersByTime(100);

      await promise;

      expect(onRetry).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should trigger onSuccess callback', async () => {
      const onSuccess = vi.fn();
      const handler = new RetryHandler({
        maxAttempts: 3,
        initialDelay: 100,
        backoff: BackoffStrategy.FIXED,
        onSuccess,
      });

      const operation = vi.fn().mockResolvedValue('success');

      await handler.execute(operation);

      expect(onSuccess).toHaveBeenCalledWith(1, 'success');
    });

    it('should trigger onFailure callback when exhausted', async () => {
      vi.useFakeTimers();

      const onFailure = vi.fn();
      const handler = new RetryHandler({
        maxAttempts: 3,
        initialDelay: 100,
        backoff: BackoffStrategy.FIXED,
        onFailure,
      });

      const operation = vi.fn().mockRejectedValue(new Error('error'));

      const promise = handler.execute(operation);

      vi.advanceTimersByTime(300);

      await promise;

      expect(onFailure).toHaveBeenCalledWith(3, expect.any(Error));

      vi.useRealTimers();
    });
  });

  describe('idempotency', () => {
    it('should prevent duplicate operations with same key', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      await retryHandler.execute(operation, { idempotencyKey: 'key1' });

      await expect(
        retryHandler.execute(operation, { idempotencyKey: 'key1' })
      ).rejects.toThrow(RetryError);
    });

    it('should allow same key after completion', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      await retryHandler.execute(operation, { idempotencyKey: 'key1' });
      const result = await retryHandler.execute(operation, { idempotencyKey: 'key1' });

      expect(result.success).toBe(true);
    });

    it('should check if idempotency key is in progress', () => {
      expect(retryHandler.isIdempotencyKeyInProgress('key1')).toBe(false);
    });

    it('should clear idempotency keys', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      await retryHandler.execute(operation, { idempotencyKey: 'key1' });
      retryHandler.clearIdempotencyKeys();

      expect(retryHandler.isIdempotencyKeyInProgress('key1')).toBe(false);
    });
  });

  describe('circuit breaker integration', () => {
    it('should throw CircuitBreakerOpenError when circuit is open', async () => {
      const mockCircuitBreaker = {
        canExecute: () => false,
        getState: () => CircuitState.OPEN,
      };

      retryHandler.setCircuitBreaker(mockCircuitBreaker as any);

      await expect(
        retryHandler.execute(vi.fn().mockResolvedValue('success'))
      ).rejects.toThrow(CircuitBreakerOpenError);
    });
  });
});

describe('RetryBuilder', () => {
  it('should build config with max attempts', () => {
    const config = new RetryBuilder()
      .withMaxAttempts(5)
      .build();

    expect(config.maxAttempts).toBe(5);
  });

  it('should build config with initial delay', () => {
    const config = new RetryBuilder()
      .withInitialDelay(2000)
      .build();

    expect(config.initialDelay).toBe(2000);
  });

  it('should build config with max delay', () => {
    const config = new RetryBuilder()
      .withMaxDelay(10000)
      .build();

    expect(config.maxDelay).toBe(10000);
  });

  it('should build config with backoff strategy', () => {
    const config = new RetryBuilder()
      .withBackoff(BackoffStrategy.EXPONENTIAL)
      .build();

    expect(config.backoff).toBe(BackoffStrategy.EXPONENTIAL);
  });

  it('should build config with jitter', () => {
    const config = new RetryBuilder()
      .withJitter(true, 0.3)
      .build();

    expect(config.jitter).toBe(true);
    expect(config.jitterFactor).toBe(0.3);
  });

  it('should build config with retryable errors', () => {
    class CustomError extends Error {}

    const config = new RetryBuilder()
      .withRetryableErrors([CustomError])
      .build();

    expect(config.retryableErrors).toContain(CustomError);
  });

  it('should build config with retryable predicates', () => {
    const predicate = (error: Error) => error.message.includes('network');

    const config = new RetryBuilder()
      .withRetryablePredicates([predicate])
      .build();

    expect(config.retryablePredicates).toContain(predicate);
  });

  it('should build config with callbacks', () => {
    const onRetry = vi.fn();
    const onSuccess = vi.fn();
    const onFailure = vi.fn();

    const config = new RetryBuilder()
      .withOnRetry(onRetry)
      .withOnSuccess(onSuccess)
      .withOnFailure(onFailure)
      .build();

    expect(config.onRetry).toBe(onRetry);
    expect(config.onSuccess).toBe(onSuccess);
    expect(config.onFailure).toBe(onFailure);
  });

  it('should create handler from builder', () => {
    const handler = new RetryBuilder()
      .withMaxAttempts(5)
      .withInitialDelay(1000)
      .createHandler();

    expect(handler).toBeInstanceOf(RetryHandler);
  });

  it('should chain builder methods', () => {
    const config = new RetryBuilder()
      .withMaxAttempts(5)
      .withInitialDelay(1000)
      .withMaxDelay(10000)
      .withBackoff(BackoffStrategy.EXPONENTIAL)
      .withJitter()
      .build();

    expect(config.maxAttempts).toBe(5);
    expect(config.initialDelay).toBe(1000);
    expect(config.maxDelay).toBe(10000);
    expect(config.backoff).toBe(BackoffStrategy.EXPONENTIAL);
    expect(config.jitter).toBe(true);
  });
});

describe('isRetryableError', () => {
  it('should return true for network errors', () => {
    expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
    expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
    expect(isRetryableError(new Error('ENOTFOUND'))).toBe(true);
  });

  it('should return true for timeout errors', () => {
    expect(isRetryableError(new Error('Request timeout'))).toBe(true);
    expect(isRetryableError(new Error('Connection timeout'))).toBe(true);
  });

  it('should return true for specific error messages', () => {
    expect(isRetryableError(new Error('Temporary failure'))).toBe(true);
    expect(isRetryableError(new Error('Service unavailable'))).toBe(true);
  });

  it('should return true for custom retryable errors', () => {
    class CustomError extends Error {}

    expect(isRetryableError(new CustomError(), [CustomError])).toBe(true);
  });

  it('should return true for predicate matches', () => {
    const predicate = (error: Error) => error.message.includes('custom');

    expect(isRetryableError(new Error('custom error'), undefined, [predicate])).toBe(true);
  });

  it('should return false for non-retryable errors', () => {
    expect(isRetryableError(new Error('Invalid input'))).toBe(false);
    expect(isRetryableError(new Error('Unauthorized'))).toBe(false);
  });
});

describe('DEFAULT_RETRY_CONFIG', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_RETRY_CONFIG.maxAttempts).toBe(3);
    expect(DEFAULT_RETRY_CONFIG.initialDelay).toBe(1000);
    expect(DEFAULT_RETRY_CONFIG.maxDelay).toBe(30000);
    expect(DEFAULT_RETRY_CONFIG.backoff).toBe(BackoffStrategy.EXPONENTIAL);
    expect(DEFAULT_RETRY_CONFIG.jitter).toBe(true);
    expect(DEFAULT_RETRY_CONFIG.jitterFactor).toBe(0.3);
  });
});

describe('RetryError', () => {
  it('should create error with attempt and original error', () => {
    const originalError = new Error('original');
    const error = new RetryError('retry failed', 3, originalError);

    expect(error.message).toBe('retry failed');
    expect(error.attempt).toBe(3);
    expect(error.originalError).toBe(originalError);
    expect(error.name).toBe('RetryError');
  });
});

describe('CircuitBreakerOpenError', () => {
  it('should create error with circuit state', () => {
    const error = new CircuitBreakerOpenError('circuit open', CircuitState.OPEN);

    expect(error.message).toBe('circuit open');
    expect(error.circuitState).toBe(CircuitState.OPEN);
    expect(error.name).toBe('CircuitBreakerOpenError');
  });
});
