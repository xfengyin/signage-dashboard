import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RateLimiter,
  RateLimiterRegistry,
  RateLimitStrategy,
  RateLimitResult,
  RateLimitError,
  FixedWindowLimiter,
  SlidingWindowLimiter,
  TokenBucketLimiter,
  ConcurrencyLimiter,
  RateLimiterConfig,
} from '../../src/resilience/rate-limiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  const defaultConfig: RateLimiterConfig = {
    strategy: RateLimitStrategy.SLIDING_WINDOW,
    maxRequests: 10,
    windowSize: 60000,
    maxConcurrent: 5,
    tokenRefillRate: 10,
    initialTokens: 10,
    queueLimit: 20,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    rateLimiter = new RateLimiter(defaultConfig);
  });

  afterEach(() => {
    vi.useRealTimers();
    RateLimiterRegistry.clear();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create rate limiter with config', () => {
      const limiter = new RateLimiter(defaultConfig);
      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it('should initialize with default values', () => {
      const limiter = new RateLimiter({
        strategy: RateLimitStrategy.FIXED_WINDOW,
        maxRequests: 100,
        windowSize: 60000,
      });
      expect(limiter).toBeInstanceOf(RateLimiter);
    });
  });

  describe('check', () => {
    it('should allow request within limit', async () => {
      const result = await rateLimiter.check('user1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should deny request when limit exceeded', async () => {
      for (let i = 0; i < 10; i++) {
        await rateLimiter.check('user1');
      }

      const result = await rateLimiter.check('user1');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
    });

    it('should track requests per key', async () => {
      await rateLimiter.check('user1');
      await rateLimiter.check('user1');
      const result = await rateLimiter.check('user2');

      expect(result.remaining).toBe(9);
    });
  });

  describe('acquire', () => {
    it('should return true when allowed', async () => {
      const acquired = await rateLimiter.acquire('user1');
      expect(acquired).toBe(true);
    });

    it('should return false when limit exceeded', async () => {
      for (let i = 0; i < 10; i++) {
        await rateLimiter.check('user1');
      }

      const acquired = await rateLimiter.acquire('user1');
      expect(acquired).toBe(false);
    });
  });

  describe('execute', () => {
    it('should execute operation when allowed', async () => {
      const operation = vi.fn().mockResolvedValue('result');

      const result = await rateLimiter.execute('user1', operation);

      expect(result).toBe('result');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should wait and retry when rate limited', async () => {
      vi.setSystemTime(0);

      for (let i = 0; i < 10; i++) {
        await rateLimiter.check('user1');
      }

      const operation = vi.fn().mockResolvedValue('result');

      const promise = rateLimiter.execute('user1', operation);

      vi.advanceTimersByTime(60000);

      const result = await promise;

      expect(result).toBe('result');
    });

    it('should throw when queue limit exceeded', async () => {
      const configWithSmallQueue: RateLimiterConfig = {
        ...defaultConfig,
        queueLimit: 0,
      };
      const limiter = new RateLimiter(configWithSmallQueue);

      for (let i = 0; i < 10; i++) {
        await limiter.check('user1');
      }

      await expect(
        limiter.execute('user1', vi.fn().mockResolvedValue('result'))
      ).rejects.toThrow(RateLimitError);
    });
  });

  describe('reset', () => {
    it('should reset rate limit for key', async () => {
      for (let i = 0; i < 5; i++) {
        await rateLimiter.check('user1');
      }

      rateLimiter.reset('user1');

      const result = await rateLimiter.check('user1');
      expect(result.remaining).toBe(9);
    });

    it('should only reset specific key', async () => {
      for (let i = 0; i < 5; i++) {
        await rateLimiter.check('user1');
        await rateLimiter.check('user2');
      }

      rateLimiter.reset('user1');

      const result1 = await rateLimiter.check('user1');
      const result2 = await rateLimiter.check('user2');

      expect(result1.remaining).toBe(9);
      expect(result2.remaining).toBe(4);
    });
  });

  describe('clear', () => {
    it('should clear all rate limits', async () => {
      await rateLimiter.check('user1');
      await rateLimiter.check('user2');

      rateLimiter.clear();

      const result1 = await rateLimiter.check('user1');
      const result2 = await rateLimiter.check('user2');

      expect(result1.remaining).toBe(9);
      expect(result2.remaining).toBe(9);
    });
  });

  describe('getMetrics', () => {
    it('should return correct metrics', () => {
      const metrics = rateLimiter.getMetrics('user1');

      expect(metrics.strategy).toBe(defaultConfig.strategy);
      expect(metrics.config).toEqual(defaultConfig);
    });
  });

  describe('RateLimiterRegistry', () => {
    it('should get or create instance', () => {
      const instance = RateLimiterRegistry.getInstance('test-limiter', defaultConfig);

      expect(instance).toBeInstanceOf(RateLimiter);
      expect(RateLimiterRegistry.hasInstance('test-limiter')).toBe(true);
    });

    it('should return existing instance', () => {
      const instance1 = RateLimiterRegistry.getInstance('test-limiter', defaultConfig);
      const instance2 = RateLimiterRegistry.getInstance('test-limiter');

      expect(instance1).toBe(instance2);
    });

    it('should throw when instance not found without config', () => {
      expect(() => RateLimiterRegistry.getInstance('non-existent')).toThrow();
    });

    it('should remove instance', () => {
      RateLimiterRegistry.getInstance('test-limiter', defaultConfig);
      RateLimiterRegistry.removeInstance('test-limiter');

      expect(RateLimiterRegistry.hasInstance('test-limiter')).toBe(false);
    });

    it('should clear all instances', () => {
      RateLimiterRegistry.getInstance('limiter1', defaultConfig);
      RateLimiterRegistry.getInstance('limiter2', defaultConfig);
      RateLimiterRegistry.clear();

      expect(RateLimiterRegistry.hasInstance('limiter1')).toBe(false);
      expect(RateLimiterRegistry.hasInstance('limiter2')).toBe(false);
    });
  });

  describe('RateLimitError', () => {
    it('should create error with rate limit result', () => {
      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        resetTime: Date.now(),
        retryAfter: 60,
      };
      const error = new RateLimitError('Rate limit exceeded', result);

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.result).toEqual(result);
      expect(error.name).toBe('RateLimitError');
    });
  });
});

describe('FixedWindowLimiter', () => {
  let limiter: FixedWindowLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    limiter = new FixedWindowLimiter(5, 10000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('check', () => {
    it('should allow requests within window', () => {
      for (let i = 0; i < 5; i++) {
        const result = limiter.check('user1');
        expect(result.allowed).toBe(true);
      }
    });

    it('should deny requests exceeding window limit', () => {
      for (let i = 0; i < 5; i++) {
        limiter.check('user1');
      }

      const result = limiter.check('user1');
      expect(result.allowed).toBe(false);
    });

    it('should reset window after timeout', () => {
      for (let i = 0; i < 5; i++) {
        limiter.check('user1');
      }

      vi.advanceTimersByTime(10000);

      const result = limiter.check('user1');
      expect(result.allowed).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset request count for key', () => {
      limiter.check('user1');
      limiter.check('user1');

      limiter.reset('user1');

      const result = limiter.check('user1');
      expect(result.remaining).toBe(5);
    });
  });

  describe('clear', () => {
    it('should clear all request data', () => {
      limiter.check('user1');
      limiter.check('user2');

      limiter.clear();

      const result = limiter.check('user1');
      expect(result.remaining).toBe(5);
    });
  });
});

describe('SlidingWindowLimiter', () => {
  let limiter: SlidingWindowLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    limiter = new SlidingWindowLimiter(5, 10000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('check', () => {
    it('should allow requests within window', () => {
      for (let i = 0; i < 5; i++) {
        const result = limiter.check('user1');
        expect(result.allowed).toBe(true);
      }
    });

    it('should deny requests exceeding window limit', () => {
      for (let i = 0; i < 5; i++) {
        limiter.check('user1');
      }

      const result = limiter.check('user1');
      expect(result.allowed).toBe(false);
    });
  });
});

describe('TokenBucketLimiter', () => {
  let limiter: TokenBucketLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    limiter = new TokenBucketLimiter(10, 5, 10);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('check', () => {
    it('should allow request when tokens available', () => {
      const result = limiter.check('user1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should deny request when tokens exhausted', () => {
      for (let i = 0; i < 10; i++) {
        limiter.check('user1');
      }

      const result = limiter.check('user1');
      expect(result.allowed).toBe(false);
    });

    it('should refill tokens over time', () => {
      for (let i = 0; i < 10; i++) {
        limiter.check('user1');
      }

      vi.advanceTimersByTime(2000);

      const result = limiter.check('user1');
      expect(result.allowed).toBe(true);
    });
  });

  describe('refill', () => {
    it('should add tokens to bucket', () => {
      limiter.check('user1');
      limiter.check('user1');

      limiter.refill('user1', 5);

      const result = limiter.check('user1');
      expect(result.remaining).toBe(12);
    });
  });
});

describe('ConcurrencyLimiter', () => {
  let limiter: ConcurrencyLimiter;

  beforeEach(() => {
    limiter = new ConcurrencyLimiter(3);
  });

  describe('acquire', () => {
    it('should acquire when under limit', async () => {
      const release1 = await limiter.acquire('user1');
      const release2 = await limiter.acquire('user1');

      expect(limiter.getActiveCount('user1')).toBe(2);

      release1();
      release2();

      expect(limiter.getActiveCount('user1')).toBe(0);
    });

    it('should queue when at limit', async () => {
      const release1 = await limiter.acquire('user1');
      const release2 = await limiter.acquire('user1');
      const release3 = await limiter.acquire('user1');

      const acquirePromise = limiter.acquire('user1');

      expect(limiter.getWaitingCount('user1')).toBe(1);

      release1();

      const release4 = await acquirePromise;
      release2();
      release3();
      release4();
    });
  });

  describe('getActiveCount', () => {
    it('should return current active count', async () => {
      expect(limiter.getActiveCount('user1')).toBe(0);

      const release1 = await limiter.acquire('user1');
      const release2 = await limiter.acquire('user1');

      expect(limiter.getActiveCount('user1')).toBe(2);

      release1();
      release2();
    });
  });

  describe('reset', () => {
    it('should reset limiter state', async () => {
      await limiter.acquire('user1');
      await limiter.acquire('user1');

      limiter.reset('user1');

      expect(limiter.getActiveCount('user1')).toBe(0);
      expect(limiter.getWaitingCount('user1')).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all limiter state', async () => {
      await limiter.acquire('user1');
      await limiter.acquire('user2');

      limiter.clear();

      expect(limiter.getActiveCount('user1')).toBe(0);
      expect(limiter.getActiveCount('user2')).toBe(0);
    });
  });
});
