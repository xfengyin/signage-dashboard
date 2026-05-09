export interface FallbackConfig<T = any> {
  fallback?: () => Promise<T>;
  fallbackValue?: T;
  shouldFallback?: (error: Error) => boolean;
  onFallback?: (error: Error, fallbackType: 'function' | 'value') => void;
  onPrimarySuccess?: (result: T) => void;
  onPrimaryFailure?: (error: Error) => void;
  logErrors?: boolean;
  maxFallbackAttempts?: number;
}

export interface FallbackResult<T = any> {
  success: boolean;
  usedFallback: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  strategy: 'primary' | 'fallback' | 'fallback_value';
}

export type FallbackCondition = 'always' | 'on_error' | 'on_timeout' | 'on_rate_limit' | 'custom';

export interface ConditionalFallbackRule<T = any> {
  condition: FallbackCondition;
  predicate?: (error: Error) => boolean;
  fallback: () => Promise<T>;
  fallbackValue?: T;
}

export class FallbackHandler<T = any> {
  private readonly config: Required<FallbackConfig<T>>;
  private fallbackHistory: Array<{
    timestamp: number;
    error?: Error;
    fallbackUsed: boolean;
  }> = [];

  constructor(config: FallbackConfig<T> = {}) {
    this.config = {
      logErrors: true,
      maxFallbackAttempts: 3,
      shouldFallback: () => true,
      onFallback: () => {},
      onPrimarySuccess: () => {},
      onPrimaryFailure: () => {},
      ...config
    } as Required<FallbackConfig<T>>;
  }

  async execute(
    primaryOperation: () => Promise<T>
  ): Promise<FallbackResult<T>> {
    let attempts = 0;
    const maxAttempts = this.config.maxFallbackAttempts!;

    while (attempts < maxAttempts) {
      attempts++;

      try {
        const result = await primaryOperation();
        this.config.onPrimarySuccess?.(result);

        return {
          success: true,
          usedFallback: false,
          result,
          attempts,
          strategy: 'primary'
        };
      } catch (error) {
        const err = error as Error;
        this.config.onPrimaryFailure?.(err);

        if (this.config.logErrors) {
          console.error(`Primary operation failed (attempt ${attempts}):`, err.message);
        }

        if (!this.config.shouldFallback!(err)) {
          return {
            success: false,
            usedFallback: false,
            error: err,
            attempts,
            strategy: 'primary'
          };
        }

        if (attempts >= maxAttempts) {
          break;
        }
      }
    }

    return this.executeFallback(null);
  }

  private async executeFallback(originalError?: Error): Promise<FallbackResult<T>> {
    if (this.config.fallbackValue !== undefined) {
      this.recordFallbackAttempt(originalError, true);

      return {
        success: true,
        usedFallback: true,
        result: this.config.fallbackValue,
        error: originalError,
        attempts: 1,
        strategy: 'fallback_value'
      };
    }

    if (this.config.fallback) {
      try {
        const result = await this.config.fallback();
        this.recordFallbackAttempt(originalError, true);
        this.config.onFallback?.(originalError!, 'function');

        return {
          success: true,
          usedFallback: true,
          result,
          error: originalError,
          attempts: 1,
          strategy: 'fallback'
        };
      } catch (fallbackError) {
        this.recordFallbackAttempt(originalError, false);

        return {
          success: false,
          usedFallback: true,
          error: fallbackError as Error,
          attempts: 1,
          strategy: 'fallback'
        };
      }
    }

    return {
      success: false,
      usedFallback: false,
      error: originalError,
      attempts: 0,
      strategy: 'primary'
    };
  }

  private recordFallbackAttempt(error?: Error, success: boolean): void {
    this.fallbackHistory.push({
      timestamp: Date.now(),
      error,
      fallbackUsed: success
    });

    if (this.fallbackHistory.length > 1000) {
      this.fallbackHistory = this.fallbackHistory.slice(-500);
    }
  }

  getFallbackHistory(): Array<{
    timestamp: number;
    error?: Error;
    fallbackUsed: boolean;
  }> {
    return [...this.fallbackHistory];
  }

  getFallbackSuccessRate(): number {
    if (this.fallbackHistory.length === 0) {
      return 0;
    }

    const successfulFallbacks = this.fallbackHistory.filter(h => h.fallbackUsed && h.error === undefined).length;
    const totalFallbacks = this.fallbackHistory.filter(h => h.fallbackUsed).length;

    return totalFallbacks > 0 ? successfulFallbacks / totalFallbacks : 0;
  }

  clearHistory(): void {
    this.fallbackHistory = [];
  }
}

export class ConditionalFallbackHandler<T = any> {
  private rules: ConditionalFallbackRule<T>[] = [];
  private readonly defaultFallback?: () => Promise<T>;
  private readonly defaultFallbackValue?: T;

  constructor(defaultFallback?: () => Promise<T>, defaultFallbackValue?: T) {
    this.defaultFallback = defaultFallback;
    this.defaultFallbackValue = defaultFallbackValue;
  }

  addRule(rule: ConditionalFallbackRule<T>): this {
    this.rules.push(rule);
    return this;
  }

  addAlwaysFallback(fallback: () => Promise<T>): this {
    this.rules.push({
      condition: 'always',
      fallback
    });
    return this;
  }

  addErrorFallback(
    predicate: (error: Error) => boolean,
    fallback: () => Promise<T>
  ): this {
    this.rules.push({
      condition: 'custom',
      predicate,
      fallback
    });
    return this;
  }

  addTimeoutFallback(fallback: () => Promise<T>): this {
    this.rules.push({
      condition: 'on_timeout',
      fallback
    });
    return this;
  }

  addRateLimitFallback(fallback: () => Promise<T>): this {
    this.rules.push({
      condition: 'on_rate_limit',
      fallback
    });
    return this;
  }

  async execute(
    primaryOperation: () => Promise<T>
  ): Promise<FallbackResult<T>> {
    try {
      const result = await primaryOperation();
      return {
        success: true,
        usedFallback: false,
        result,
        attempts: 1,
        strategy: 'primary'
      };
    } catch (error) {
      const err = error as Error;
      const matchingRule = this.findMatchingRule(err);

      if (matchingRule) {
        return this.executeRuleFallback(matchingRule, err);
      }

      if (this.defaultFallback || this.defaultFallbackValue !== undefined) {
        return this.executeDefaultFallback(err);
      }

      return {
        success: false,
        usedFallback: false,
        error: err,
        attempts: 1,
        strategy: 'primary'
      };
    }
  }

  private findMatchingRule(error: Error): ConditionalFallbackRule<T> | undefined {
    return this.rules.find(rule => {
      switch (rule.condition) {
        case 'always':
          return true;
        case 'on_error':
          return true;
        case 'on_timeout':
          return error.message.includes('timeout') || error.name === 'TimeoutError';
        case 'on_rate_limit':
          return error.name === 'RateLimitError' || error.message.includes('rate limit');
        case 'custom':
          return rule.predicate ? rule.predicate(error) : false;
        default:
          return false;
      }
    });
  }

  private async executeRuleFallback(
    rule: ConditionalFallbackRule<T>,
    originalError: Error
  ): Promise<FallbackResult<T>> {
    if (rule.fallbackValue !== undefined) {
      return {
        success: true,
        usedFallback: true,
        result: rule.fallbackValue,
        error: originalError,
        attempts: 1,
        strategy: 'fallback_value'
      };
    }

    if (rule.fallback) {
      try {
        const result = await rule.fallback();
        return {
          success: true,
          usedFallback: true,
          result,
          error: originalError,
          attempts: 1,
          strategy: 'fallback'
        };
      } catch (fallbackError) {
        return {
          success: false,
          usedFallback: true,
          error: fallbackError as Error,
          attempts: 1,
          strategy: 'fallback'
        };
      }
    }

    return this.executeDefaultFallback(originalError);
  }

  private async executeDefaultFallback(originalError: Error): Promise<FallbackResult<T>> {
    if (this.defaultFallbackValue !== undefined) {
      return {
        success: true,
        usedFallback: true,
        result: this.defaultFallbackValue,
        error: originalError,
        attempts: 1,
        strategy: 'fallback_value'
      };
    }

    if (this.defaultFallback) {
      try {
        const result = await this.defaultFallback();
        return {
          success: true,
          usedFallback: true,
          result,
          error: originalError,
          attempts: 1,
          strategy: 'fallback'
        };
      } catch (fallbackError) {
        return {
          success: false,
          usedFallback: true,
          error: fallbackError as Error,
          attempts: 1,
          strategy: 'fallback'
        };
      }
    }

    return {
      success: false,
      usedFallback: false,
      error: originalError,
      attempts: 1,
      strategy: 'primary'
    };
  }

  getRules(): ConditionalFallbackRule<T>[] {
    return [...this.rules];
  }

  clearRules(): void {
    this.rules = [];
  }
}

export class ChainedFallbackHandler<T = any> {
  private handlers: Array<FallbackHandler<T>> = [];

  addHandler(handler: FallbackHandler<T>): this {
    this.handlers.push(handler);
    return this;
  }

  async execute(
    operations: Array<() => Promise<T>>
  ): Promise<FallbackResult<T>> {
    let lastError: Error | undefined;

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      const handler = this.handlers[i];

      try {
        if (handler) {
          const result = await handler.execute(operation);
          if (result.success) {
            return result;
          }
          lastError = result.error;
        } else {
          const result = await operation();
          return {
            success: true,
            usedFallback: i > 0,
            result,
            attempts: 1,
            strategy: i > 0 ? 'fallback' : 'primary'
          };
        }
      } catch (error) {
        lastError = error as Error;
      }
    }

    return {
      success: false,
      usedFallback: operations.length > 1,
      error: lastError,
      attempts: operations.length,
      strategy: 'fallback'
    };
  }
}

export function createFallbackHandler<T>(
  config?: FallbackConfig<T>
): FallbackHandler<T> {
  return new FallbackHandler<T>(config);
}

export function createConditionalFallbackHandler<T>(
  defaultFallback?: () => Promise<T>,
  defaultFallbackValue?: T
): ConditionalFallbackHandler<T> {
  return new ConditionalFallbackHandler<T>(defaultFallback, defaultFallbackValue);
}

export function createChainedFallbackHandler<T>(): ChainedFallbackHandler<T> {
  return new ChainedFallbackHandler<T>();
}
