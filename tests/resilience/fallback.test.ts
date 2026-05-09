import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FallbackHandler,
  ConditionalFallbackHandler,
  ChainedFallbackHandler,
  FallbackConfig,
  FallbackResult,
  FallbackCondition,
  createFallbackHandler,
  createConditionalFallbackHandler,
  createChainedFallbackHandler,
} from '../../src/resilience/fallback';

describe('FallbackHandler', () => {
  let handler: FallbackHandler<string>;

  beforeEach(() => {
    handler = new FallbackHandler<string>();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should return primary result on success', async () => {
      const operation = vi.fn().mockResolvedValue('primary result');

      const result = await handler.execute(operation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('primary result');
      expect(result.usedFallback).toBe(false);
      expect(result.strategy).toBe('primary');
    });

    it('should return fallback result on failure', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('primary failed'));
      const fallback = vi.fn().mockResolvedValue('fallback result');

      const result = await handler.execute(operation, fallback);

      expect(result.success).toBe(true);
      expect(result.result).toBe('fallback result');
      expect(result.usedFallback).toBe(true);
      expect(result.strategy).toBe('fallback');
    });

    it('should return fallback value on failure', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('primary failed'));
      const handlerWithValue = new FallbackHandler<string>({
        fallbackValue: 'static fallback',
      });

      const result = await handlerWithValue.execute(operation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('static fallback');
      expect(result.strategy).toBe('fallback_value');
    });

    it('should call onPrimarySuccess callback', async () => {
      const onPrimarySuccess = vi.fn();
      const handlerWithCallback = new FallbackHandler<string>({ onPrimarySuccess });
      const operation = vi.fn().mockResolvedValue('success');

      await handlerWithCallback.execute(operation);

      expect(onPrimarySuccess).toHaveBeenCalledWith('success');
    });

    it('should call onPrimaryFailure callback', async () => {
      const onPrimaryFailure = vi.fn();
      const handlerWithCallback = new FallbackHandler<string>({ onPrimaryFailure });
      const operation = vi.fn().mockRejectedValue(new Error('failed'));

      await handlerWithCallback.execute(operation);

      expect(onPrimaryFailure).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should respect shouldFallback condition', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('specific error'));
      const handlerWithCondition = new FallbackHandler<string>({
        shouldFallback: (error) => error.message !== 'specific error',
      });
      const fallback = vi.fn().mockResolvedValue('fallback');

      const result = await handlerWithCondition.execute(operation, fallback);

      expect(result.success).toBe(false);
      expect(result.usedFallback).toBe(false);
      expect(fallback).not.toHaveBeenCalled();
    });

    it('should retry multiple attempts', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('error 1'))
        .mockRejectedValueOnce(new Error('error 2'))
        .mockResolvedValue('success');

      const result = await handler.execute(operation);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });

    it('should respect maxFallbackAttempts', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('always fails'));
      const handlerWithMax = new FallbackHandler<string>({
        maxFallbackAttempts: 2,
      });

      const result = await handlerWithMax.execute(operation);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(2);
    });
  });

  describe('fallback history', () => {
    it('should record fallback attempts', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('failed'));
      const fallback = vi.fn().mockResolvedValue('fallback');

      await handler.execute(operation, fallback);

      const history = handler.getFallbackHistory();

      expect(history.length).toBe(1);
      expect(history[0].fallbackUsed).toBe(true);
    });

    it('should track fallback success rate', async () => {
      const failedFallback = vi.fn().mockRejectedValue(new Error('fallback failed'));
      const successFallback = vi.fn().mockResolvedValue('success');

      const failedOperation = vi.fn().mockRejectedValue(new Error('failed'));
      const successOperation = vi.fn().mockRejectedValue(new Error('failed'));

      await handler.execute(failedOperation, failedFallback);
      await handler.execute(successOperation, successFallback);

      const rate = handler.getFallbackSuccessRate();

      expect(rate).toBe(0.5);
    });

    it('should clear history', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('failed'));
      const fallback = vi.fn().mockResolvedValue('fallback');

      await handler.execute(operation, fallback);
      handler.clearHistory();

      const history = handler.getFallbackHistory();

      expect(history.length).toBe(0);
    });

    it('should limit history to 1000 entries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('failed'));
      const fallback = vi.fn().mockResolvedValue('fallback');

      for (let i = 0; i < 1500; i++) {
        await handler.execute(operation, fallback);
      }

      const history = handler.getFallbackHistory();

      expect(history.length).toBeLessThanOrEqual(1000);
    });
  });
});

describe('ConditionalFallbackHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should return primary result on success', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const handler = createConditionalFallbackHandler<string>();

      const result = await handler.execute(operation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
    });

    it('should use default fallback on error', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('failed'));
      const defaultFallback = vi.fn().mockResolvedValue('default');
      const handler = createConditionalFallbackHandler<string>(defaultFallback);

      const result = await handler.execute(operation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('default');
      expect(defaultFallback).toHaveBeenCalled();
    });

    it('should use default fallback value', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('failed'));
      const handler = createConditionalFallbackHandler<string>(undefined, 'static value');

      const result = await handler.execute(operation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('static value');
      expect(result.strategy).toBe('fallback_value');
    });
  });

  describe('addRule', () => {
    it('should add always fallback rule', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('failed'));
      const handler = createConditionalFallbackHandler<string>();
      const fallback = vi.fn().mockResolvedValue('fallback');

      handler.addAlwaysFallback(fallback);

      const result = await handler.execute(operation);

      expect(result.success).toBe(true);
      expect(fallback).toHaveBeenCalled();
    });

    it('should add timeout fallback rule', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Operation timed out'));
      const handler = createConditionalFallbackHandler<string>();
      const fallback = vi.fn().mockResolvedValue('timeout fallback');

      handler.addTimeoutFallback(fallback);

      const result = await handler.execute(operation);

      expect(result.success).toBe(true);
      expect(fallback).toHaveBeenCalled();
    });

    it('should add rate limit fallback rule', async () => {
      const operation = vi.fn().mockRejectedValue(new RateLimitError('rate limit', {
        allowed: false,
        remaining: 0,
        resetTime: Date.now(),
      }));
      const handler = createConditionalFallbackHandler<string>();
      const fallback = vi.fn().mockResolvedValue('rate limit fallback');

      handler.addRateLimitFallback(fallback);

      const result = await handler.execute(operation);

      expect(result.success).toBe(true);
      expect(fallback).toHaveBeenCalled();
    });

    it('should add custom predicate fallback rule', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('network error'));
      const handler = createConditionalFallbackHandler<string>();
      const fallback = vi.fn().mockResolvedValue('custom fallback');

      handler.addErrorFallback(
        (error) => error.message.includes('network'),
        fallback
      );

      const result = await handler.execute(operation);

      expect(result.success).toBe(true);
      expect(fallback).toHaveBeenCalled();
    });

    it('should match first matching rule', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('timeout error'));
      const handler = createConditionalFallbackHandler<string>();

      const timeoutFallback = vi.fn().mockResolvedValue('timeout');
      const errorFallback = vi.fn().mockResolvedValue('error');

      handler.addTimeoutFallback(timeoutFallback);
      handler.addErrorFallback(() => true, errorFallback);

      const result = await handler.execute(operation);

      expect(result.success).toBe(true);
      expect(timeoutFallback).toHaveBeenCalled();
      expect(errorFallback).not.toHaveBeenCalled();
    });

    it('should return error when no matching rule', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('specific error'));
      const handler = createConditionalFallbackHandler<string>();
      const fallback = vi.fn().mockResolvedValue('fallback');

      handler.addErrorFallback(
        (error) => error.message.includes('different'),
        fallback
      );

      const result = await handler.execute(operation);

      expect(result.success).toBe(false);
      expect(result.usedFallback).toBe(false);
    });
  });

  describe('rule management', () => {
    it('should return all rules', () => {
      const handler = createConditionalFallbackHandler<string>();
      const fallback1 = vi.fn();
      const fallback2 = vi.fn();

      handler.addAlwaysFallback(fallback1);
      handler.addTimeoutFallback(fallback2);

      const rules = handler.getRules();

      expect(rules.length).toBe(2);
    });

    it('should clear all rules', () => {
      const handler = createConditionalFallbackHandler<string>();
      const fallback = vi.fn();

      handler.addAlwaysFallback(fallback);
      handler.clearRules();

      expect(handler.getRules().length).toBe(0);
    });
  });
});

describe('ChainedFallbackHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addHandler', () => {
    it('should add fallback handler', () => {
      const handler = createChainedFallbackHandler<string>();
      const fallbackHandler = new FallbackHandler<string>();

      const result = handler.addHandler(fallbackHandler);

      expect(result).toBe(handler);
    });
  });

  describe('execute', () => {
    it('should execute first successful operation', async () => {
      const handler = createChainedFallbackHandler<string>();
      const operations = [
        vi.fn().mockRejectedValue(new Error('fail 1')),
        vi.fn().mockRejectedValue(new Error('fail 2')),
        vi.fn().mockResolvedValue('success'),
      ];

      const result = await handler.execute(operations);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(3);
    });

    it('should use fallback handlers when provided', async () => {
      const handler = createChainedFallbackHandler<string>();
      const fallbackHandler = new FallbackHandler<string>({
        fallbackValue: 'fallback result',
      });

      handler.addHandler(fallbackHandler);

      const operations = [vi.fn().mockRejectedValue(new Error('failed'))];

      const result = await handler.execute(operations);

      expect(result.success).toBe(true);
      expect(result.result).toBe('fallback result');
    });

    it('should return last error when all operations fail', async () => {
      const handler = createChainedFallbackHandler<string>();
      const operations = [
        vi.fn().mockRejectedValue(new Error('error 1')),
        vi.fn().mockRejectedValue(new Error('error 2')),
      ];

      const result = await handler.execute(operations);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('error 2');
      expect(result.usedFallback).toBe(false);
    });

    it('should indicate when fallback was used', async () => {
      const handler = createChainedFallbackHandler<string>();
      const operations = [
        vi.fn().mockRejectedValue(new Error('fail')),
        vi.fn().mockResolvedValue('success'),
      ];

      const result = await handler.execute(operations);

      expect(result.usedFallback).toBe(true);
    });
  });
});

describe('createFallbackHandler', () => {
  it('should create fallback handler with config', () => {
    const handler = createFallbackHandler<string>({
      fallbackValue: 'default',
    });

    expect(handler).toBeInstanceOf(FallbackHandler);
  });

  it('should create handler without config', () => {
    const handler = createFallbackHandler<string>();

    expect(handler).toBeInstanceOf(FallbackHandler);
  });
});

describe('createConditionalFallbackHandler', () => {
  it('should create handler with fallback function', () => {
    const handler = createConditionalFallbackHandler<string>(
      () => Promise.resolve('fallback')
    );

    expect(handler).toBeInstanceOf(ConditionalFallbackHandler);
  });

  it('should create handler with fallback value', () => {
    const handler = createConditionalFallbackHandler<string>(undefined, 'value');

    expect(handler).toBeInstanceOf(ConditionalFallbackHandler);
  });

  it('should create handler without fallback', () => {
    const handler = createConditionalFallbackHandler<string>();

    expect(handler).toBeInstanceOf(ConditionalFallbackHandler);
  });
});

describe('createChainedFallbackHandler', () => {
  it('should create chained fallback handler', () => {
    const handler = createChainedFallbackHandler<string>();

    expect(handler).toBeInstanceOf(ChainedFallbackHandler);
  });
});

describe('FallbackResult', () => {
  it('should have correct structure for success', async () => {
    const handler = new FallbackHandler<string>();
    const operation = vi.fn().mockResolvedValue('result');

    const result = await handler.execute(operation);

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('usedFallback');
    expect(result).toHaveProperty('result');
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('attempts');
    expect(result).toHaveProperty('strategy');
  });
});

describe('RateLimitError mock for tests', () => {
  class RateLimitError extends Error {
    constructor(
      message: string,
      public readonly result: { allowed: boolean; remaining: number; resetTime: number }
    ) {
      super(message);
      this.name = 'RateLimitError';
    }
  }

  it('should be used in rate limit fallback test', async () => {
    const error = new RateLimitError('rate limit', {
      allowed: false,
      remaining: 0,
      resetTime: Date.now(),
    });

    expect(error.name).toBe('RateLimitError');
    expect(error.result.allowed).toBe(false);
  });
});
