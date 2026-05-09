export enum BackoffStrategy {
  FIXED = 'FIXED',
  LINEAR = 'LINEAR',
  EXPONENTIAL = 'EXPONENTIAL',
  FIBONACCI = 'FIBONACCI'
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay?: number;
  backoff: BackoffStrategy;
  jitter?: boolean;
  jitterFactor?: number;
  retryableErrors?: Array<new (...args: any[]) => Error>;
  retryablePredicates?: Array<(error: Error) => boolean>;
  onRetry?: (attempt: number, error: Error, delay: number) => void;
  onSuccess?: (attempt: number, result: any) => void;
  onFailure?: (attempt: number, error: Error) => void;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
  delays: number[];
}

export class RetryCalculator {
  static calculateDelay(
    attempt: number,
    config: RetryConfig
  ): number {
    let delay: number;

    switch (config.backoff) {
      case BackoffStrategy.FIXED:
        delay = config.initialDelay;
        break;
      case BackoffStrategy.LINEAR:
        delay = config.initialDelay * attempt;
        break;
      case BackoffStrategy.EXPONENTIAL:
        delay = config.initialDelay * Math.pow(2, attempt - 1);
        break;
      case BackoffStrategy.FIBONACCI:
        delay = config.initialDelay * this.fibonacci(attempt);
        break;
      default:
        delay = config.initialDelay * Math.pow(2, attempt - 1);
    }

    if (config.maxDelay && delay > config.maxDelay) {
      delay = config.maxDelay;
    }

    if (config.jitter) {
      const jitterFactor = config.jitterFactor || 0.5;
      const jitter = delay * jitterFactor * (Math.random() * 2 - 1);
      delay = Math.max(0, delay + jitter);
    }

    return Math.round(delay);
  }

  private static fibonacci(n: number): number {
    if (n <= 1) return 1;
    let a = 1, b = 1;
    for (let i = 2; i < n; i++) {
      const temp = a + b;
      a = b;
      b = temp;
    }
    return b;
  }
}

export class RetryHandler {
  private readonly config: Required<RetryConfig>;
  private circuitBreaker?: import('./circuit-breaker').CircuitBreaker;
  private idempotencyKeys: Map<string, number> = new Map();
  private readonly defaultRetryableErrors: Array<new (...args: any[]) => Error> = [];

  constructor(config: RetryConfig) {
    this.config = {
      maxDelay: 30000,
      jitter: false,
      jitterFactor: 0.5,
      retryableErrors: [],
      retryablePredicates: [],
      onRetry: () => {},
      onSuccess: () => {},
      onFailure: () => {},
      ...config
    };
  }

  setCircuitBreaker(circuitBreaker: import('./circuit-breaker').CircuitBreaker): void {
    this.circuitBreaker = circuitBreaker;
  }

  async execute<T>(
    operation: () => Promise<T>,
    options?: {
      idempotencyKey?: string;
      context?: Record<string, any>;
    }
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    const delays: number[] = [];
    let lastError: Error;

    if (options?.idempotencyKey) {
      const existingAttempt = this.idempotencyKeys.get(options.idempotencyKey);
      if (existingAttempt !== undefined) {
        throw new RetryError(
          `Operation with idempotency key '${options.idempotencyKey}' is already in progress`,
          0,
          new Error('Duplicate operation')
        );
      }
      this.idempotencyKeys.set(options.idempotencyKey, 1);
    }

    try {
      for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
        try {
          if (this.circuitBreaker && !this.circuitBreaker.canExecute()) {
            throw new CircuitBreakerOpenError(
              'Circuit breaker is open',
              this.circuitBreaker.getState()
            );
          }

          const result = await operation();

          if (options?.idempotencyKey) {
            this.idempotencyKeys.delete(options.idempotencyKey);
          }

          this.config.onSuccess(attempt, result);

          return {
            success: true,
            result,
            attempts: attempt,
            totalDuration: Date.now() - startTime,
            delays
          };
        } catch (error) {
          lastError = error as Error;

          if (!this.isRetryable(error as Error)) {
            if (options?.idempotencyKey) {
              this.idempotencyKeys.delete(options.idempotencyKey);
            }
            this.config.onFailure(attempt, lastError);
            throw lastError;
          }

          if (attempt < this.config.maxAttempts) {
            const delay = RetryCalculator.calculateDelay(attempt, this.config);
            delays.push(delay);

            this.config.onRetry(attempt, lastError, delay);

            if (this.circuitBreaker) {
              this.circuitBreaker.execute(() => Promise.resolve());
            }

            await this.sleep(delay);
          }
        }
      }

      if (options?.idempotencyKey) {
        this.idempotencyKeys.delete(options.idempotencyKey);
      }

      this.config.onFailure(this.config.maxAttempts, lastError!);

      return {
        success: false,
        error: lastError,
        attempts: this.config.maxAttempts,
        totalDuration: Date.now() - startTime,
        delays
      };
    } finally {
      if (options?.idempotencyKey) {
        this.idempotencyKeys.delete(options.idempotencyKey);
      }
    }
  }

  private isRetryable(error: Error): boolean {
    for (const ErrorClass of this.config.retryableErrors) {
      if (error instanceof ErrorClass) {
        return true;
      }
    }

    for (const predicate of this.config.retryablePredicates) {
      if (predicate(error)) {
        return true;
      }
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isIdempotencyKeyInProgress(key: string): boolean {
    return this.idempotencyKeys.has(key);
  }

  clearIdempotencyKeys(): void {
    this.idempotencyKeys.clear();
  }
}

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempt: number,
    public readonly originalError: Error
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(
    message: string,
    public readonly circuitState: import('./circuit-breaker').CircuitState
  ) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

export function isRetryableError(
  error: Error,
  retryableErrors?: Array<new (...args: any[]) => Error>,
  retryablePredicates?: Array<(error: Error) => boolean>
): boolean {
  if (retryableErrors) {
    for (const ErrorClass of retryableErrors) {
      if (error instanceof ErrorClass) {
        return true;
      }
    }
  }

  if (retryablePredicates) {
    for (const predicate of retryablePredicates) {
      if (predicate(error)) {
        return true;
      }
    }
  }

  const networkErrors = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ENETUNREACH',
    'EHOSTUNREACH'
  ];

  if (error.message && networkErrors.some(e => error.message.includes(e))) {
    return true;
  }

  if (error.message && (
    error.message.includes('timeout') ||
    error.message.includes('TIMEOUT') ||
    error.message.includes('network') ||
    error.message.includes('connection')
  )) {
    return true;
  }

  return error.message === 'Temporary failure' || error.message === 'Service unavailable';
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoff: BackoffStrategy.EXPONENTIAL,
  jitter: true,
  jitterFactor: 0.3,
  retryableErrors: [],
  retryablePredicates: []
};

export class RetryBuilder {
  private config: Partial<RetryConfig> = {};

  withMaxAttempts(maxAttempts: number): this {
    this.config.maxAttempts = maxAttempts;
    return this;
  }

  withInitialDelay(delay: number): this {
    this.config.initialDelay = delay;
    return this;
  }

  withMaxDelay(delay: number): this {
    this.config.maxDelay = delay;
    return this;
  }

  withBackoff(backoff: BackoffStrategy): this {
    this.config.backoff = backoff;
    return this;
  }

  withJitter(enabled: boolean = true, factor: number = 0.5): this {
    this.config.jitter = enabled;
    this.config.jitterFactor = factor;
    return this;
  }

  withRetryableErrors(errors: Array<new (...args: any[]) => Error>): this {
    this.config.retryableErrors = errors;
    return this;
  }

  withRetryablePredicates(predicates: Array<(error: Error) => boolean>): this {
    this.config.retryablePredicates = predicates;
    return this;
  }

  withOnRetry(callback: (attempt: number, error: Error, delay: number) => void): this {
    this.config.onRetry = callback;
    return this;
  }

  withOnSuccess(callback: (attempt: number, result: any) => void): this {
    this.config.onSuccess = callback;
    return this;
  }

  withOnFailure(callback: (attempt: number, error: Error) => void): this {
    this.config.onFailure = callback;
    return this;
  }

  build(): RetryConfig {
    return {
      ...DEFAULT_RETRY_CONFIG,
      ...this.config
    };
  }

  createHandler(): RetryHandler {
    return new RetryHandler(this.build());
  }
}
