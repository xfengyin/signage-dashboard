export {
  CircuitBreaker,
  CircuitBreakerError,
  CircuitBreakerRegistry,
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerEvents,
  CircuitBreakerMetrics
} from './circuit-breaker';

export {
  RateLimiter,
  RateLimitError,
  RateLimiterRegistry,
  RateLimiterConfig,
  RateLimitResult,
  RateLimitStrategy,
  FixedWindowLimiter,
  SlidingWindowLimiter,
  TokenBucketLimiter,
  ConcurrencyLimiter,
  RateLimiterMetrics
} from './rate-limiter';

export {
  RetryHandler,
  RetryError,
  RetryConfig,
  RetryResult,
  RetryCalculator,
  RetryBuilder,
  DEFAULT_RETRY_CONFIG,
  isRetryableError,
  BackoffStrategy,
  CircuitBreakerOpenError
} from './retry';

export {
  TimeoutHandler,
  TimeoutError,
  TimeoutConfig,
  TimeoutResult,
  TimeoutManager,
  withTimeout,
  createTimeoutHandler
} from './timeout';

export {
  FallbackHandler,
  ConditionalFallbackHandler,
  ChainedFallbackHandler,
  FallbackConfig,
  FallbackResult,
  createFallbackHandler,
  createConditionalFallbackHandler,
  createChainedFallbackHandler,
  FallbackCondition,
  ConditionalFallbackRule
} from './fallback';

import { CircuitBreaker, CircuitBreakerConfig, CircuitBreakerEvents, CircuitState } from './circuit-breaker';
import { RateLimiter, RateLimiterConfig, RateLimitStrategy } from './rate-limiter';
import { RetryHandler, RetryConfig, RetryBuilder } from './retry';
import { TimeoutHandler, TimeoutConfig } from './timeout';
import { FallbackHandler, FallbackConfig, ConditionalFallbackHandler, ChainedFallbackHandler } from './fallback';

export interface ResilientOperationConfig {
  circuitBreaker?: CircuitBreakerConfig;
  rateLimiter?: RateLimiterConfig;
  retry?: RetryConfig;
  timeout?: TimeoutConfig;
  fallback?: FallbackConfig;
}

export class ResilientClient {
  private circuitBreaker?: CircuitBreaker;
  private rateLimiter?: RateLimiter;
  private retryHandler?: RetryHandler;
  private timeoutHandler?: TimeoutHandler;
  private fallbackHandler?: FallbackHandler;
  private readonly config: ResilientOperationConfig;

  constructor(config: ResilientOperationConfig) {
    this.config = config;

    if (config.circuitBreaker) {
      const cbEvents: CircuitBreakerEvents = {
        onOpen: (cb) => console.log(`Circuit breaker OPENED: ${cb.getState()}`),
        onClose: (cb) => console.log(`Circuit breaker CLOSED: ${cb.getState()}`),
        onHalfOpen: (cb) => console.log(`Circuit breaker HALF_OPEN: ${cb.getState()}`)
      };
      this.circuitBreaker = new CircuitBreaker(config.circuitBreaker, cbEvents);
    }

    if (config.rateLimiter) {
      this.rateLimiter = new RateLimiter(config.rateLimiter);
    }

    if (config.retry) {
      this.retryHandler = new RetryHandler(config.retry);
      if (this.circuitBreaker) {
        this.retryHandler.setCircuitBreaker(this.circuitBreaker);
      }
    }

    if (config.timeout) {
      this.timeoutHandler = new TimeoutHandler(config.timeout.timeout, config.timeout);
    }

    if (config.fallback) {
      this.fallbackHandler = new FallbackHandler(config.fallback);
    }
  }

  async execute<T>(
    operation: () => Promise<T>,
    options?: {
      key?: string;
      timeout?: number;
      fallback?: () => Promise<T>;
    }
  ): Promise<T> {
    let finalOperation = operation;

    if (this.rateLimiter && options?.key) {
      const limiter = this.rateLimiter;
      finalOperation = async () => {
        const allowed = await limiter.acquire(options.key!);
        if (!allowed) {
          throw new Error('Rate limit exceeded');
        }
        return operation();
      };
    }

    if (this.circuitBreaker) {
      const cb = this.circuitBreaker;
      const fb = options?.fallback;
      finalOperation = () => cb.execute(finalOperation, fb);
    }

    if (this.retryHandler) {
      const handler = this.retryHandler;
      finalOperation = () => handler.execute(finalOperation).then(r => r.result as T);
    }

    if (this.timeoutHandler) {
      const handler = this.timeoutHandler;
      finalOperation = () => handler.execute(finalOperation, options?.timeout);
    }

    if (this.fallbackHandler && options?.fallback) {
      const fbHandler = this.fallbackHandler;
      const fb = options.fallback;
      finalOperation = async () => {
        try {
          return await finalOperation();
        } catch (error) {
          return fb();
        }
      };
    }

    return finalOperation();
  }

  getCircuitBreaker(): CircuitBreaker | undefined {
    return this.circuitBreaker;
  }

  getRateLimiter(): RateLimiter | undefined {
    return this.rateLimiter;
  }

  getRetryHandler(): RetryHandler | undefined {
    return this.retryHandler;
  }

  getTimeoutHandler(): TimeoutHandler | undefined {
    return this.timeoutHandler;
  }

  getFallbackHandler(): FallbackHandler | undefined {
    return this.fallbackHandler;
  }
}

export function createResilientClient(config: ResilientOperationConfig): ResilientClient {
  return new ResilientClient(config);
}
