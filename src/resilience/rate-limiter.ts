export enum RateLimitStrategy {
  FIXED_WINDOW = 'FIXED_WINDOW',
  SLIDING_WINDOW = 'SLIDING_WINDOW',
  TOKEN_BUCKET = 'TOKEN_BUCKET',
  CONCURRENCY = 'CONCURRENCY'
}

export interface RateLimiterConfig {
  strategy: RateLimitStrategy;
  maxRequests: number;
  windowSize: number;
  maxConcurrent?: number;
  tokenRefillRate?: number;
  initialTokens?: number;
  queueLimit?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export class FixedWindowLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowSize: number;

  constructor(maxRequests: number, windowSize: number) {
    this.maxRequests = maxRequests;
    this.windowSize = windowSize;
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowSize;

    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const timestamps = this.requests.get(key)!;
    const validTimestamps = timestamps.filter(t => t > windowStart);

    this.requests.set(key, validTimestamps);

    if (validTimestamps.length >= this.maxRequests) {
      const oldestRequest = Math.min(...validTimestamps);
      return {
        allowed: false,
        remaining: 0,
        resetTime: oldestRequest + this.windowSize,
        retryAfter: Math.ceil((oldestRequest + this.windowSize - now) / 1000)
      };
    }

    validTimestamps.push(now);
    return {
      allowed: true,
      remaining: this.maxRequests - validTimestamps.length,
      resetTime: now + this.windowSize
    };
  }

  reset(key: string): void {
    this.requests.delete(key);
  }

  clear(): void {
    this.requests.clear();
  }
}

export class SlidingWindowLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowSize: number;

  constructor(maxRequests: number, windowSize: number) {
    this.maxRequests = maxRequests;
    this.windowSize = windowSize;
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowSize;

    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const timestamps = this.requests.get(key)!;
    const validTimestamps = timestamps.filter(t => t > windowStart);

    const currentCount = validTimestamps.length;

    if (currentCount >= this.maxRequests) {
      const oldestInWindow = validTimestamps[0];
      return {
        allowed: false,
        remaining: 0,
        resetTime: oldestInWindow + this.windowSize,
        retryAfter: Math.ceil((oldestInWindow + this.windowSize - now) / 1000)
      };
    }

    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);

    const oldestRemaining = validTimestamps[0];
    return {
      allowed: true,
      remaining: this.maxRequests - validTimestamps.length,
      resetTime: oldestRemaining + this.windowSize
    };
  }

  reset(key: string): void {
    this.requests.delete(key);
  }

  clear(): void {
    this.requests.clear();
  }
}

export class TokenBucketLimiter {
  private tokens: Map<string, { count: number; lastRefill: number }> = new Map();
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private readonly initialTokens: number;

  constructor(maxTokens: number, refillRate: number, initialTokens?: number) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.initialTokens = initialTokens ?? maxTokens;
  }

  check(key: string, tokensNeeded: number = 1): RateLimitResult {
    const now = Date.now();

    if (!this.tokens.has(key)) {
      this.tokens.set(key, {
        count: this.initialTokens,
        lastRefill: now
      });
    }

    const bucket = this.tokens.get(key)!;
    const elapsed = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = Math.floor(elapsed * this.refillRate);

    if (tokensToAdd > 0) {
      bucket.count = Math.min(this.maxTokens, bucket.count + tokensToAdd);
      bucket.lastRefill = now;
    }

    if (bucket.count < tokensNeeded) {
      const tokensNeeded_ = tokensNeeded - bucket.count;
      const waitTime = Math.ceil(tokensNeeded_ / this.refillRate * 1000);
      return {
        allowed: false,
        remaining: Math.floor(bucket.count),
        resetTime: now + waitTime,
        retryAfter: Math.ceil(waitTime / 1000)
      };
    }

    bucket.count -= tokensNeeded;
    return {
      allowed: true,
      remaining: Math.floor(bucket.count),
      resetTime: now + Math.ceil((this.maxTokens - bucket.count) / this.refillRate * 1000)
    };
  }

  reset(key: string): void {
    this.tokens.delete(key);
  }

  clear(): void {
    this.tokens.clear();
  }

  refill(key: string, tokens: number): void {
    if (this.tokens.has(key)) {
      const bucket = this.tokens.get(key)!;
      bucket.count = Math.min(this.maxTokens, bucket.count + tokens);
    }
  }
}

export class ConcurrencyLimiter {
  private activeCount: Map<string, number> = new Map();
  private waitingQueue: Map<string, Array<() => void>> = new Map();
  private readonly maxConcurrent: number;

  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
  }

  async acquire(key: string): Promise<() => void> {
    if (!this.activeCount.has(key)) {
      this.activeCount.set(key, 0);
    }

    if (!this.waitingQueue.has(key)) {
      this.waitingQueue.set(key, []);
    }

    const currentActive = this.activeCount.get(key)!;

    if (currentActive < this.maxConcurrent) {
      this.activeCount.set(key, currentActive + 1);
      return () => this.release(key);
    }

    return new Promise<() => void>((resolve) => {
      this.waitingQueue.get(key)!.push(() => {
        this.activeCount.set(key, this.activeCount.get(key)! + 1);
        resolve(() => this.release(key));
      });
    });
  }

  private release(key: string): void {
    const queue = this.waitingQueue.get(key) || [];
    if (queue.length > 0) {
      const next = queue.shift()!;
      next();
    } else {
      const current = this.activeCount.get(key) || 0;
      this.activeCount.set(key, Math.max(0, current - 1));
    }
  }

  getActiveCount(key: string): number {
    return this.activeCount.get(key) || 0;
  }

  getWaitingCount(key: string): number {
    return this.waitingQueue.get(key)?.length || 0;
  }

  reset(key: string): void {
    this.activeCount.delete(key);
    this.waitingQueue.delete(key);
  }

  clear(): void {
    this.activeCount.clear();
    this.waitingQueue.clear();
  }
}

export class RateLimiter {
  private fixedWindow: FixedWindowLimiter;
  private slidingWindow: SlidingWindowLimiter;
  private tokenBucket: TokenBucketLimiter;
  private concurrencyLimiter: ConcurrencyLimiter;
  private readonly config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = config;
    this.fixedWindow = new FixedWindowLimiter(config.maxRequests, config.windowSize);
    this.slidingWindow = new SlidingWindowLimiter(config.maxRequests, config.windowSize);
    this.tokenBucket = new TokenBucketLimiter(
      config.maxRequests,
      config.tokenRefillRate || config.maxRequests,
      config.initialTokens
    );
    this.concurrencyLimiter = new ConcurrencyLimiter(config.maxConcurrent || 1);
  }

  async check(key: string): Promise<RateLimitResult> {
    switch (this.config.strategy) {
      case RateLimitStrategy.FIXED_WINDOW:
        return this.fixedWindow.check(key);
      case RateLimitStrategy.SLIDING_WINDOW:
        return this.slidingWindow.check(key);
      case RateLimitStrategy.TOKEN_BUCKET:
        return this.tokenBucket.check(key);
      case RateLimitStrategy.CONCURRENCY:
        return {
          allowed: this.concurrencyLimiter.getActiveCount(key) < (this.config.maxConcurrent || 1),
          remaining: (this.config.maxConcurrent || 1) - this.concurrencyLimiter.getActiveCount(key),
          resetTime: Date.now()
        };
      default:
        return this.slidingWindow.check(key);
    }
  }

  async acquire(key: string): Promise<boolean> {
    const result = await this.check(key);
    return result.allowed;
  }

  async execute<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const release = await this.concurrencyLimiter.acquire(key);
    try {
      const result = await this.check(key);
      if (!result.allowed) {
        if (this.config.queueLimit && this.concurrencyLimiter.getWaitingCount(key) >= this.config.queueLimit) {
          throw new RateLimitError('Queue limit exceeded', result);
        }
        await this.waitForAvailability(key, result.retryAfter || 1);
      }
      return await operation();
    } finally {
      release();
    }
  }

  private async waitForAvailability(key: string, seconds: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), seconds * 1000);
    });
  }

  reset(key: string): void {
    this.fixedWindow.reset(key);
    this.slidingWindow.reset(key);
    this.tokenBucket.reset(key);
    this.concurrencyLimiter.reset(key);
  }

  clear(): void {
    this.fixedWindow.clear();
    this.slidingWindow.clear();
    this.tokenBucket.clear();
    this.concurrencyLimiter.clear();
  }

  getMetrics(key: string): RateLimiterMetrics {
    return {
      strategy: this.config.strategy,
      activeCount: this.concurrencyLimiter.getActiveCount(key),
      waitingCount: this.concurrencyLimiter.getWaitingCount(key),
      config: this.config
    };
  }
}

export interface RateLimiterMetrics {
  strategy: RateLimitStrategy;
  activeCount: number;
  waitingCount: number;
  config: RateLimiterConfig;
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly result: RateLimitResult
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class RateLimiterRegistry {
  private static instances: Map<string, RateLimiter> = new Map();

  static getInstance(name: string, config?: RateLimiterConfig): RateLimiter {
    if (!this.instances.has(name)) {
      if (!config) {
        throw new Error(`Rate limiter '${name}' not found and no config provided`);
      }
      this.instances.set(name, new RateLimiter(config));
    }
    return this.instances.get(name)!;
  }

  static hasInstance(name: string): boolean {
    return this.instances.has(name);
  }

  static removeInstance(name: string): void {
    this.instances.delete(name);
  }

  static clear(): void {
    this.instances.clear();
  }
}
