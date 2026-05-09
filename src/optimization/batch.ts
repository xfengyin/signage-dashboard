export type BatchStrategy = 'fixed' | 'dynamic' | 'adaptive';

export interface BatchItem<T = unknown, R = unknown> {
  id: string;
  data: T;
  priority?: number;
  timestamp?: number;
  retryCount?: number;
  maxRetries?: number;
  onSuccess?: (result: R) => void;
  onError?: (error: Error) => void;
}

export interface BatchConfig<T = unknown, R = unknown> {
  strategy: BatchStrategy;
  maxBatchSize: number;
  maxWaitTime: number;
  maxConcurrency: number;
  processor: (items: BatchItem<T, R>[]) => Promise<Map<string, R>>;
  onBatchComplete?: (results: Map<string, R>, duration: number) => void;
  onError?: (error: Error, item: BatchItem<T, R>) => void;
}

export interface QueueMetrics {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalProcessed: number;
  avgProcessingTime: number;
  throughput: number;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  shouldRetry?: (error: Error) => boolean;
}

export interface DynamicBatchConfig extends BatchConfig {
  minBatchSize: number;
  targetLatency: number;
  scaleFactor: number;
}

export interface AdaptiveBatchState {
  currentBatchSize: number;
  avgLatency: number;
  throughput: number;
  queueDepth: number;
}

export class RetryManager {
  private config: RetryConfig;

  constructor(config: RetryConfig) {
    this.config = {
      maxRetries: 3,
      initialDelay: 100,
      maxDelay: 5000,
      backoffMultiplier: 2,
      ...config,
    };
  }

  async execute<T>(
    fn: () => Promise<T>,
    onRetry?: (attempt: number, error: Error) => void
  ): Promise<T> {
    let lastError: Error;
    let delay = this.config.initialDelay;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.config.maxRetries) {
          if (this.config.shouldRetry && !this.config.shouldRetry(lastError)) {
            throw lastError;
          }
          onRetry?.(attempt + 1, lastError);
          await this.sleep(delay);
          delay = Math.min(delay * this.config.backoffMultiplier, this.config.maxDelay);
        }
      }
    }

    throw lastError!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  calculateDelay(attempt: number): number {
    const delay = this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attempt);
    return Math.min(delay, this.config.maxDelay);
  }
}

export class Queue<T = unknown, R = unknown> {
  private items: BatchItem<T, R>[] = [];
  private priorityComparator: (a: BatchItem<T, R>, b: BatchItem<T, R>) => number;

  constructor(options?: { priorityEnabled?: boolean }) {
    this.priorityComparator = options?.priorityEnabled
      ? (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
      : (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0);
  }

  enqueue(item: BatchItem<T, R>): void {
    this.items.push(item);
    this.items.sort(this.priorityComparator);
  }

  enqueueBatch(items: BatchItem<T, R>[]): void {
    this.items.push(...items);
    this.items.sort(this.priorityComparator);
  }

  dequeue(): BatchItem<T, R> | undefined {
    return this.items.shift();
  }

  dequeueBatch(size: number): BatchItem<T, R>[] {
    const batch = this.items.splice(0, size);
    return batch;
  }

  peek(): BatchItem<T, R> | undefined {
    return this.items[0];
  }

  size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}

export class FixedBatchProcessor<T = unknown, R = unknown> {
  private queue: Queue<T, R>;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private processing: boolean = false;
  private config: Required<BatchConfig<T, R>>;
  private retryManager: RetryManager;

  constructor(config: BatchConfig<T, R>) {
    this.queue = new Queue<T, R>({ priorityEnabled: true });
    this.retryManager = new RetryManager({ maxRetries: 0 });
    this.config = {
      strategy: config.strategy,
      maxBatchSize: config.maxBatchSize,
      maxWaitTime: config.maxWaitTime,
      maxConcurrency: config.maxConcurrency,
      processor: config.processor,
      onBatchComplete: config.onBatchComplete ?? (() => {}),
      onError: config.onError ?? (() => {}),
    };
  }

  async add(item: BatchItem<T, R>): Promise<R> {
    return new Promise((resolve, reject) => {
      const wrappedItem: BatchItem<T, R> = {
        ...item,
        onSuccess: (result: R) => {
          item.onSuccess?.(result);
          resolve(result);
        },
        onError: (error: Error) => {
          if (item.retryCount !== undefined && item.retryCount < (item.maxRetries ?? 0)) {
            item.retryCount = (item.retryCount ?? 0) + 1;
            this.queue.enqueue(item);
          } else {
            item.onError?.(error);
            reject(error);
          }
        },
      };

      this.queue.enqueue(wrappedItem);
      this.scheduleProcessing();
    });
  }

  private scheduleProcessing(): void {
    if (this.timer) return;

    this.timer = setTimeout(async () => {
      this.timer = null;
      await this.process();
    }, this.config.maxWaitTime);
  }

  private async process(): Promise<void> {
    if (this.processing || this.queue.size() === 0) return;

    this.processing = true;
    const startTime = Date.now();

    try {
      const batch = this.queue.dequeueBatch(this.config.maxBatchSize);

      const results = await this.processBatch(batch);
      const duration = Date.now() - startTime;

      this.config.onBatchComplete(results, duration);
    } finally {
      this.processing = false;
      if (this.queue.size() > 0) {
        this.scheduleProcessing();
      }
    }
  }

  private async processBatch(batch: BatchItem<T, R>[]): Promise<Map<string, R>> {
    const results = new Map<string, R>();

    const chunks = this.chunkArray(batch, this.config.maxConcurrency);
    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map(async (item) => {
          try {
            const result = await this.config.processor([item]);
            item.onSuccess?.(result.get(item.id)!);
            return { item, result: result.get(item.id)! };
          } catch (error) {
            item.onError?.(error as Error);
            throw error;
          }
        })
      );

      for (const settled of chunkResults) {
        if (settled.status === 'fulfilled') {
          results.set(settled.value.item.id, settled.value.result);
        }
      }
    }

    return results;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  size(): number {
    return this.queue.size();
  }

  clear(): void {
    this.queue.clear();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

export class DynamicBatchProcessor<T = unknown, R = unknown> extends FixedBatchProcessor<T, R> {
  private dynamicConfig: DynamicBatchConfig;
  private state: AdaptiveBatchState;

  constructor(config: DynamicBatchConfig) {
    super(config);
    this.dynamicConfig = config;
    this.state = {
      currentBatchSize: config.minBatchSize,
      avgLatency: 0,
      throughput: 0,
      queueDepth: 0,
    };
  }

  async add(item: BatchItem<T, R>): Promise<R> {
    this.state.queueDepth++;
    const result = await super.add(item);
    this.state.queueDepth--;
    return result;
  }

  calculateOptimalBatchSize(): number {
    const { currentBatchSize, avgLatency, throughput, queueDepth } = this.state;
    const { minBatchSize, maxBatchSize, targetLatency, scaleFactor } = this.dynamicConfig;

    if (avgLatency > targetLatency * 1.5) {
      return Math.max(minBatchSize, Math.floor(currentBatchSize * 0.8));
    }

    if (avgLatency < targetLatency * 0.5 && throughput > 0) {
      return Math.min(maxBatchSize, Math.floor(currentBatchSize * scaleFactor));
    }

    if (queueDepth > currentBatchSize * 3) {
      return Math.min(maxBatchSize, Math.floor(currentBatchSize * 1.5));
    }

    return currentBatchSize;
  }

  updateState(processingTime: number, itemsProcessed: number): void {
    this.state.queueDepth = this.size();
    this.state.avgLatency = processingTime;
    this.state.throughput = itemsProcessed / (processingTime / 1000);
    this.state.currentBatchSize = this.calculateOptimalBatchSize();
  }

  getState(): AdaptiveBatchState {
    return { ...this.state };
  }
}

export class AdaptiveBatchProcessor<T = unknown, R = unknown> extends DynamicBatchProcessor<T, R> {
  private history: { latency: number; batchSize: number; timestamp: number }[] = [];
  private windowSize: number = 100;

  constructor(config: DynamicBatchConfig) {
    super(config);
  }

  protected async processBatch(batch: BatchItem<T, R>[]): Promise<Map<string, R>> {
    const startTime = Date.now();
    const results = await super.processBatch(batch);
    const duration = Date.now() - startTime;

    this.recordMetrics(duration, batch.length);
    this.updateState(duration, batch.length);

    return results;
  }

  private recordMetrics(latency: number, batchSize: number): void {
    this.history.push({
      latency,
      batchSize,
      timestamp: Date.now(),
    });

    if (this.history.length > this.windowSize) {
      this.history.shift();
    }
  }

  getOptimalBatchSize(): number {
    if (this.history.length < 10) {
      return this.dynamicConfig.minBatchSize;
    }

    const recentHistory = this.history.slice(-50);
    const avgLatency = recentHistory.reduce((sum, h) => sum + h.latency, 0) / recentHistory.length;
    const avgBatchSize = recentHistory.reduce((sum, h) => sum + h.batchSize, 0) / recentHistory.length;

    const targetLatency = this.dynamicConfig.targetLatency;
    if (avgLatency > targetLatency * 1.2) {
      return Math.max(this.dynamicConfig.minBatchSize, Math.floor(avgBatchSize * 0.9));
    }
    if (avgLatency < targetLatency * 0.8) {
      return Math.min(this.dynamicConfig.maxBatchSize, Math.floor(avgBatchSize * 1.1));
    }

    return Math.round(avgBatchSize);
  }

  getMetrics(): {
    avgLatency: number;
    avgBatchSize: number;
    throughput: number;
    efficiency: number;
  } {
    if (this.history.length === 0) {
      return { avgLatency: 0, avgBatchSize: 0, throughput: 0, efficiency: 0 };
    }

    const avgLatency = this.history.reduce((sum, h) => sum + h.latency, 0) / this.history.length;
    const avgBatchSize = this.history.reduce((sum, h) => sum + h.batchSize, 0) / this.history.length;
    const totalItems = this.history.reduce((sum, h) => sum + h.batchSize, 0);
    const totalTime = (Date.now() - this.history[0].timestamp) / 1000;
    const throughput = totalTime > 0 ? totalItems / totalTime : 0;
    const efficiency = avgBatchSize / avgLatency;

    return { avgLatency, avgBatchSize, throughput, efficiency };
  }
}

export class BatchManager<T = unknown, R = unknown> {
  private processors: Map<string, BatchProcessor<T, R>> = new Map();
  private config: BatchConfig<T, R>;

  constructor(config: BatchConfig<T, R>) {
    this.config = config;
  }

  register(name: string, processor: BatchProcessor<T, R>): void {
    this.processors.set(name, processor);
  }

  get(name: string): BatchProcessor<T, R> | undefined {
    return this.processors.get(name);
  }

  async add(item: BatchItem<T, R>, processorName: string = 'default'): Promise<R> {
    const processor = this.processors.get(processorName);
    if (!processor) {
      throw new Error(`Processor ${processorName} not found`);
    }
    return processor.add(item);
  }

  clear(processorName?: string): void {
    if (processorName) {
      this.processors.get(processorName)?.clear();
    } else {
      for (const processor of this.processors.values()) {
        processor.clear();
      }
    }
  }

  getMetrics(): Record<string, QueueMetrics> {
    const result: Record<string, QueueMetrics> = {};
    for (const [name, processor] of this.processors) {
      result[name] = processor.getMetrics();
    }
    return result;
  }
}

export type BatchProcessor<T = unknown, R = unknown> =
  | FixedBatchProcessor<T, R>
  | DynamicBatchProcessor<T, R>
  | AdaptiveBatchProcessor<T, R>;

export const createBatchProcessor = <T = unknown, R = unknown>(
  config: BatchConfig<T, R>
): BatchProcessor<T, R> => {
  switch (config.strategy) {
    case 'fixed':
      return new FixedBatchProcessor(config);
    case 'dynamic':
      return new DynamicBatchProcessor(config as DynamicBatchConfig);
    case 'adaptive':
      return new AdaptiveBatchProcessor(config as DynamicBatchConfig);
    default:
      return new FixedBatchProcessor(config);
  }
};

export class RequestMerger<T = unknown> {
  private pendingRequests: Map<string, { resolve: (value: unknown) => void; items: Set<string> }> = new Map();
  private mergeWindow: number;
  private factory: (keys: string[]) => Promise<T>;

  constructor(mergeWindow: number, factory: (keys: string[]) => Promise<T>) {
    this.mergeWindow = mergeWindow;
    this.factory = factory;
  }

  async request(key: string): Promise<T> {
    const existing = this.pendingRequests.get(key);
    if (existing) {
      return new Promise((resolve) => {
        existing.items.add(key);
        existing.resolve;
      });
    }

    return new Promise((resolve, reject) => {
      const entry = { resolve, items: new Set([key]) };
      this.pendingRequests.set(key, entry);

      setTimeout(async () => {
        try {
          const keys = Array.from(entry.items);
          const result = await this.factory(keys);
          for (const k of keys) {
            const pending = this.pendingRequests.get(k);
            if (pending) {
              pending.resolve(result);
              this.pendingRequests.delete(k);
            }
          }
        } catch (error) {
          for (const k of entry.items) {
            const pending = this.pendingRequests.get(k);
            if (pending) {
              pending.resolve(Promise.reject(error));
              this.pendingRequests.delete(k);
            }
          }
          reject(error);
        }
      }, this.mergeWindow);
    });
  }
}

export class ConcurrencyController {
  private running: number = 0;
  private waiting: Array<() => void> = [];
  private maxConcurrency: number;

  constructor(maxConcurrency: number) {
    this.maxConcurrency = maxConcurrency;
  }

  async acquire(): Promise<void> {
    if (this.running < this.maxConcurrency) {
      this.running++;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    this.running--;
    const next = this.waiting.shift();
    if (next) {
      this.running++;
      next();
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  getStats(): { running: number; waiting: number; maxConcurrency: number } {
    return {
      running: this.running,
      waiting: this.waiting.length,
      maxConcurrency: this.maxConcurrency,
    };
  }
}
