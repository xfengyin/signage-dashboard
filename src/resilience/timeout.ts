export interface TimeoutConfig {
  timeout: number;
  fallback?: () => any;
  onTimeout?: (operation: string | undefined) => void;
  onSuccess?: (duration: number) => void;
  onError?: (error: Error, duration: number) => void;
  operationName?: string;
}

export interface TimeoutResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  duration: number;
  timedOut: boolean;
}

export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeout: number,
    public readonly operationName?: string
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class TimeoutHandler {
  private readonly defaultTimeout: number;
  private readonly config: TimeoutConfig;

  constructor(defaultTimeout: number, config?: Partial<TimeoutConfig>) {
    this.defaultTimeout = defaultTimeout;
    this.config = {
      onTimeout: () => {},
      onSuccess: () => {},
      onError: () => {},
      ...config
    } as TimeoutConfig;
  }

  async execute<T>(
    operation: () => Promise<T>,
    timeout?: number,
    operationName?: string
  ): Promise<T> {
    const timeoutValue = timeout || this.defaultTimeout;
    const name = operationName || this.config.operationName || 'anonymous';
    const startTime = Date.now();

    try {
      const result = await this.raceWithTimeout(operation, timeoutValue, name);
      const duration = Date.now() - startTime;
      this.config.onSuccess?.(duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error instanceof TimeoutError) {
        this.config.onTimeout?.(name);
        if (this.config.fallback) {
          return this.config.fallback();
        }
      } else {
        this.config.onError?.(error as Error, duration);
      }
      
      throw error;
    }
  }

  async executeWithResult<T>(
    operation: () => Promise<T>,
    timeout?: number,
    operationName?: string
  ): Promise<TimeoutResult<T>> {
    const timeoutValue = timeout || this.defaultTimeout;
    const name = operationName || this.config.operationName || 'anonymous';
    const startTime = Date.now();

    try {
      const result = await this.raceWithTimeout(operation, timeoutValue, name);
      const duration = Date.now() - startTime;
      this.config.onSuccess?.(duration);

      return {
        success: true,
        result,
        duration,
        timedOut: false
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const timedOut = error instanceof TimeoutError;

      if (timedOut) {
        this.config.onTimeout?.(name);
      } else {
        this.config.onError?.(error as Error, duration);
      }

      return {
        success: false,
        error: error as Error,
        duration,
        timedOut
      };
    }
  }

  private raceWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number,
    operationName: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new TimeoutError(
          `Operation '${operationName}' timed out after ${timeout}ms`,
          timeout,
          operationName
        ));
      }, timeout);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  async executeWithAbort<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    timeout?: number,
    operationName?: string
  ): Promise<T> {
    const timeoutValue = timeout || this.defaultTimeout;
    const name = operationName || this.config.operationName || 'anonymous';
    const controller = new AbortController();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        controller.abort();
        const error = new TimeoutError(
          `Operation '${name}' timed out after ${timeoutValue}ms`,
          timeoutValue,
          name
        );
        this.config.onTimeout?.(name);
        if (this.config.fallback) {
          resolve(this.config.fallback());
        } else {
          reject(error);
        }
      }, timeoutValue);

      operation(controller.signal)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          if (error.name === 'AbortError') {
            const timeoutError = new TimeoutError(
              `Operation '${name}' was aborted`,
              timeoutValue,
              name
            );
            this.config.onTimeout?.(name);
            if (this.config.fallback) {
              resolve(this.config.fallback());
            } else {
              reject(timeoutError);
            }
          } else {
            this.config.onError?.(error, timeoutValue);
            reject(error);
          }
        });
    });
  }

  wrap<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    timeout?: number,
    operationName?: string
  ): T {
    const timeoutValue = timeout || this.defaultTimeout;
    const name = operationName || fn.name || 'anonymous';

    return (async (...args: Parameters<T>) => {
      return this.execute(
        () => fn(...args),
        timeoutValue,
        name
      );
    }) as T;
  }
}

export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeout: number,
  operationName?: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(
        `Operation '${operationName || 'anonymous'}' timed out after ${timeout}ms`,
        timeout,
        operationName
      ));
    }, timeout);

    operation()
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export function createTimeoutHandler(
  defaultTimeout: number,
  config?: Partial<TimeoutConfig>
): TimeoutHandler {
  return new TimeoutHandler(defaultTimeout, config);
}

export class TimeoutManager {
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  private operationTimings: Map<string, number[]> = new Map();

  setTimeout(name: string, fn: () => void, timeout: number): void {
    this.clearTimeout(name);
    const timer = setTimeout(() => {
      fn();
      this.timeouts.delete(name);
    }, timeout);
    this.timeouts.set(name, timer);
  }

  clearTimeout(name: string): void {
    const timer = this.timeouts.get(name);
    if (timer) {
      clearTimeout(timer);
      this.timeouts.delete(name);
    }
  }

  clearAllTimeouts(): void {
    this.timeouts.forEach(timer => clearTimeout(timer));
    this.timeouts.clear();
  }

  recordTiming(name: string, duration: number): void {
    if (!this.operationTimings.has(name)) {
      this.operationTimings.set(name, []);
    }
    const timings = this.operationTimings.get(name)!;
    timings.push(duration);
    
    if (timings.length > 100) {
      timings.shift();
    }
  }

  getAverageDuration(name: string): number {
    const timings = this.operationTimings.get(name);
    if (!timings || timings.length === 0) {
      return 0;
    }
    return timings.reduce((sum, t) => sum + t, 0) / timings.length;
  }

  getPercentile(name: string, percentile: number): number {
    const timings = this.operationTimings.get(name);
    if (!timings || timings.length === 0) {
      return 0;
    }
    
    const sorted = [...timings].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  getMetrics(): Map<string, {
    count: number;
    average: number;
    p50: number;
    p95: number;
    p99: number;
  }> {
    const metrics = new Map();
    
    this.operationTimings.forEach((timings, name) => {
      if (timings.length > 0) {
        metrics.set(name, {
          count: timings.length,
          average: this.getAverageDuration(name),
          p50: this.getPercentile(name, 50),
          p95: this.getPercentile(name, 95),
          p99: this.getPercentile(name, 99)
        });
      }
    });
    
    return metrics;
  }
}
