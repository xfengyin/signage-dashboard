export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
  monitorInterval?: number;
}

export interface CircuitBreakerEvents {
  onOpen?: (circuit: CircuitBreaker) => void;
  onClose?: (circuit: CircuitBreaker) => void;
  onHalfOpen?: (circuit: CircuitBreaker) => void;
  onSuccess?: (circuit: CircuitBreaker) => void;
  onFailure?: (circuit: CircuitBreaker, error: Error) => void;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: number;
  private nextAttempt?: number;
  private readonly config: CircuitBreakerConfig;
  private readonly events: CircuitBreakerEvents;

  constructor(config: CircuitBreakerConfig, events?: CircuitBreakerEvents) {
    this.config = {
      monitorInterval: 5000,
      ...config
    };
    this.events = events || {};
  }

  async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      if (fallback) {
        return fallback();
      }
      throw new CircuitBreakerError('Circuit breaker is OPEN', this.state);
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      if (fallback) {
        return fallback();
      }
      throw error;
    }
  }

  private canExecute(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      if (Date.now() >= (this.nextAttempt || 0)) {
        this.transitionTo(CircuitState.HALF_OPEN);
        return true;
      }
      return false;
    }

    return this.state === CircuitState.HALF_OPEN;
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }

    this.events.onSuccess?.(this);
  }

  private onFailure(error: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
    } else if (this.state === CircuitState.CLOSED && this.failureCount >= this.config.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }

    this.events.onFailure?.(this, error);
  }

  private transitionTo(newState: CircuitState): void {
    const previousState = this.state;
    this.state = newState;

    switch (newState) {
      case CircuitState.OPEN:
        this.nextAttempt = Date.now() + this.config.resetTimeout;
        this.events.onOpen?.(this);
        break;
      case CircuitState.CLOSED:
        this.failureCount = 0;
        this.successCount = 0;
        this.nextAttempt = undefined;
        this.events.onClose?.(this);
        break;
      case CircuitState.HALF_OPEN:
        this.successCount = 0;
        this.events.onHalfOpen?.(this);
        break;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  getSuccessCount(): number {
    return this.successCount;
  }

  isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  isClosed(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  isHalfOpen(): boolean {
    return this.state === CircuitState.HALF_OPEN;
  }

  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
  }

  forceOpen(): void {
    this.transitionTo(CircuitState.OPEN);
  }

  forceHalfOpen(): void {
    this.transitionTo(CircuitState.HALF_OPEN);
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt
    };
  }
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  nextAttempt?: number;
}

export class CircuitBreakerError extends Error {
  constructor(message: string, public readonly circuitState: CircuitState) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreakerRegistry {
  private static instances: Map<string, CircuitBreaker> = new Map();

  static getInstance(name: string, config?: CircuitBreakerConfig, events?: CircuitBreakerEvents): CircuitBreaker {
    if (!this.instances.has(name)) {
      if (!config) {
        throw new Error(`Circuit breaker '${name}' not found and no config provided`);
      }
      this.instances.set(name, new CircuitBreaker(config, events));
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

  static getAllMetrics(): Map<string, CircuitBreakerMetrics> {
    const metrics = new Map<string, CircuitBreakerMetrics>();
    this.instances.forEach((circuit, name) => {
      metrics.set(name, circuit.getMetrics());
    });
    return metrics;
  }
}
