import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Queue,
  RetryManager,
  FixedBatchProcessor,
  DynamicBatchProcessor,
  AdaptiveBatchProcessor,
  BatchManager,
  ConcurrencyController,
  createBatchProcessor,
} from '../../src/optimization/batch';

describe('Queue', () => {
  let queue: Queue;

  beforeEach(() => {
    queue = new Queue();
  });

  describe('enqueue', () => {
    it('should add items to queue', () => {
      queue.enqueue({ id: '1', data: 'test' });
      expect(queue.size()).toBe(1);
    });

    it('should maintain priority order', () => {
      queue.enqueue({ id: '1', data: 'low', priority: 1 });
      queue.enqueue({ id: '2', data: 'high', priority: 10 });
      queue.enqueue({ id: '3', data: 'medium', priority: 5 });

      const item = queue.peek();
      expect(item?.id).toBe('2');
    });
  });

  describe('enqueueBatch', () => {
    it('should add multiple items', () => {
      queue.enqueueBatch([
        { id: '1', data: 'a' },
        { id: '2', data: 'b' },
      ]);

      expect(queue.size()).toBe(2);
    });
  });

  describe('dequeue', () => {
    it('should remove and return first item', () => {
      queue.enqueue({ id: '1', data: 'test' });
      const item = queue.dequeue();

      expect(item?.id).toBe('1');
      expect(queue.size()).toBe(0);
    });

    it('should return undefined for empty queue', () => {
      expect(queue.dequeue()).toBeUndefined();
    });
  });

  describe('dequeueBatch', () => {
    it('should return batch of items', () => {
      for (let i = 1; i <= 5; i++) {
        queue.enqueue({ id: String(i), data: i });
      }

      const batch = queue.dequeueBatch(3);

      expect(batch).toHaveLength(3);
      expect(queue.size()).toBe(2);
    });
  });

  describe('clear', () => {
    it('should remove all items', () => {
      queue.enqueue({ id: '1', data: 'a' });
      queue.enqueue({ id: '2', data: 'b' });
      queue.clear();

      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty queue', () => {
      expect(queue.isEmpty()).toBe(true);
    });

    it('should return false for non-empty queue', () => {
      queue.enqueue({ id: '1', data: 'a' });
      expect(queue.isEmpty()).toBe(false);
    });
  });
});

describe('RetryManager', () => {
  let retryManager: RetryManager;

  beforeEach(() => {
    vi.useFakeTimers();
    retryManager = new RetryManager({
      maxRetries: 3,
      initialDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('execute', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await retryManager.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('error'))
        .mockResolvedValue('success');

      const promise = retryManager.execute(fn);

      vi.advanceTimersByTime(100);
      await Promise.resolve();

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('persistent error'));

      const promise = retryManager.execute(fn);

      vi.advanceTimersByTime(1000);

      await expect(promise).rejects.toThrow('persistent error');
      expect(fn).toHaveBeenCalledTimes(4);
    });

    it('should call onRetry callback', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('error'))
        .mockResolvedValue('success');
      const onRetry = vi.fn();

      const promise = retryManager.execute(fn, onRetry);

      vi.advanceTimersByTime(100);
      await promise;

      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });
  });

  describe('calculateDelay', () => {
    it('should calculate exponential backoff', () => {
      expect(retryManager.calculateDelay(0)).toBe(100);
      expect(retryManager.calculateDelay(1)).toBe(200);
      expect(retryManager.calculateDelay(2)).toBe(400);
    });

    it('should cap at max delay', () => {
      expect(retryManager.calculateDelay(10)).toBe(1000);
    });
  });
});

describe('FixedBatchProcessor', () => {
  let processor: FixedBatchProcessor;
  let mockProcessor: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockProcessor = vi.fn().mockImplementation(async (items) => {
      const results = new Map();
      for (const item of items) {
        results.set(item.id, { processed: item.data });
      }
      return results;
    });

    processor = new FixedBatchProcessor({
      strategy: 'fixed',
      maxBatchSize: 5,
      maxWaitTime: 1000,
      maxConcurrency: 2,
      processor: mockProcessor,
    });
  });

  afterEach(() => {
    processor.clear();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('add', () => {
    it('should add item and return result', async () => {
      const promise = processor.add({ id: '1', data: 'test' });

      vi.advanceTimersByTime(1000);
      const result = await promise;

      expect(result.processed).toBe('test');
    });

    it('should batch multiple items', async () => {
      const promises = [
        processor.add({ id: '1', data: 'a' }),
        processor.add({ id: '2', data: 'b' }),
        processor.add({ id: '3', data: 'c' }),
      ];

      vi.advanceTimersByTime(1000);

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockProcessor).toHaveBeenCalled();
    });
  });

  describe('size', () => {
    it('should return queue size', () => {
      processor.add({ id: '1', data: 'a' });
      processor.add({ id: '2', data: 'b' });

      expect(processor.size()).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear pending items', () => {
      processor.add({ id: '1', data: 'a' });
      processor.clear();

      expect(processor.size()).toBe(0);
    });
  });
});

describe('DynamicBatchProcessor', () => {
  let processor: DynamicBatchProcessor;

  beforeEach(() => {
    vi.useFakeTimers();
    processor = new DynamicBatchProcessor({
      strategy: 'dynamic',
      maxBatchSize: 10,
      maxWaitTime: 1000,
      maxConcurrency: 2,
      processor: async (items) => new Map(items.map(i => [i.id, i.data])),
      minBatchSize: 3,
      targetLatency: 100,
      scaleFactor: 1.5,
    });
  });

  afterEach(() => {
    processor.clear();
    vi.useRealTimers();
  });

  describe('calculateOptimalBatchSize', () => {
    it('should return optimal batch size based on state', () => {
      const size = processor.calculateOptimalBatchSize();

      expect(size).toBeGreaterThanOrEqual(3);
      expect(size).toBeLessThanOrEqual(10);
    });
  });

  describe('updateState', () => {
    it('should update internal state', () => {
      processor.updateState(50, 10);

      const state = processor.getState();

      expect(state.avgLatency).toBe(50);
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      const state = processor.getState();

      expect(state).toHaveProperty('currentBatchSize');
      expect(state).toHaveProperty('avgLatency');
      expect(state).toHaveProperty('throughput');
    });
  });
});

describe('AdaptiveBatchProcessor', () => {
  let processor: AdaptiveBatchProcessor;

  beforeEach(() => {
    vi.useFakeTimers();
    processor = new AdaptiveBatchProcessor({
      strategy: 'adaptive',
      maxBatchSize: 10,
      maxWaitTime: 1000,
      maxConcurrency: 2,
      processor: async (items) => new Map(items.map(i => [i.id, i.data])),
      minBatchSize: 3,
      targetLatency: 100,
      scaleFactor: 1.5,
    });
  });

  afterEach(() => {
    processor.clear();
    vi.useRealTimers();
  });

  describe('getOptimalBatchSize', () => {
    it('should return configured min size initially', () => {
      const size = processor.getOptimalBatchSize();

      expect(size).toBe(3);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics', () => {
      const metrics = processor.getMetrics();

      expect(metrics).toHaveProperty('avgLatency');
      expect(metrics).toHaveProperty('avgBatchSize');
      expect(metrics).toHaveProperty('throughput');
      expect(metrics).toHaveProperty('efficiency');
    });
  });
});

describe('BatchManager', () => {
  let manager: BatchManager;

  beforeEach(() => {
    manager = new BatchManager({
      strategy: 'fixed',
      maxBatchSize: 5,
      maxWaitTime: 1000,
      maxConcurrency: 2,
      processor: async (items) => new Map(items.map(i => [i.id, i.data])),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('register', () => {
    it('should register processor', () => {
      const processor = new FixedBatchProcessor({
        strategy: 'fixed',
        maxBatchSize: 5,
        maxWaitTime: 1000,
        maxConcurrency: 2,
        processor: async () => new Map(),
      });

      manager.register('custom', processor);

      expect(manager.get('custom')).toBe(processor);
    });
  });

  describe('add', () => {
    it('should add item to default processor', async () => {
      vi.useFakeTimers();

      const promise = manager.add({ id: '1', data: 'test' });

      vi.advanceTimersByTime(1000);
      const result = await promise;

      expect(result).toBe('test');

      vi.useRealTimers();
    });

    it('should throw for non-existent processor', async () => {
      await expect(
        manager.add({ id: '1', data: 'test' }, 'non-existent')
      ).rejects.toThrow('Processor non-existent not found');
    });
  });

  describe('clear', () => {
    it('should clear specific processor', () => {
      const processor = new FixedBatchProcessor({
        strategy: 'fixed',
        maxBatchSize: 5,
        maxWaitTime: 1000,
        maxConcurrency: 2,
        processor: async () => new Map(),
      });

      manager.register('custom', processor);

      manager.clear('custom');

      expect(manager.get('custom')?.size()).toBe(0);
    });

    it('should clear all processors', () => {
      const processor = new FixedBatchProcessor({
        strategy: 'fixed',
        maxBatchSize: 5,
        maxWaitTime: 1000,
        maxConcurrency: 2,
        processor: async () => new Map(),
      });

      manager.register('p1', processor);
      manager.register('p2', processor);

      manager.clear();

      expect(manager.get('p1')?.size()).toBe(0);
      expect(manager.get('p2')?.size()).toBe(0);
    });
  });
});

describe('ConcurrencyController', () => {
  let controller: ConcurrencyController;

  beforeEach(() => {
    vi.useFakeTimers();
    controller = new ConcurrencyController(2);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('acquire', () => {
    it('should allow concurrent operations up to limit', async () => {
      await controller.acquire();
      await controller.acquire();

      const stats = controller.getStats();
      expect(stats.running).toBe(2);
      expect(stats.waiting).toBe(0);
    });

    it('should queue when at limit', async () => {
      await controller.acquire();
      await controller.acquire();

      const promise = controller.acquire();

      const stats = controller.getStats();
      expect(stats.running).toBe(2);
      expect(stats.waiting).toBe(1);
    });
  });

  describe('release', () => {
    it('should release and allow queued operation', async () => {
      await controller.acquire();
      await controller.acquire();

      const acquirePromise = controller.acquire();
      controller.release();

      await acquirePromise;

      const stats = controller.getStats();
      expect(stats.running).toBe(2);
      expect(stats.waiting).toBe(0);
    });
  });

  describe('run', () => {
    it('should run operation with concurrency control', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const result = await controller.run(fn);

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalled();
    });
  });
});

describe('createBatchProcessor', () => {
  it('should create fixed batch processor', () => {
    const processor = createBatchProcessor({
      strategy: 'fixed',
      maxBatchSize: 5,
      maxWaitTime: 1000,
      maxConcurrency: 2,
      processor: async () => new Map(),
    });

    expect(processor).toBeInstanceOf(FixedBatchProcessor);
  });

  it('should create dynamic batch processor', () => {
    const processor = createBatchProcessor({
      strategy: 'dynamic',
      maxBatchSize: 10,
      maxWaitTime: 1000,
      maxConcurrency: 2,
      processor: async () => new Map(),
      minBatchSize: 3,
      targetLatency: 100,
      scaleFactor: 1.5,
    });

    expect(processor).toBeInstanceOf(DynamicBatchProcessor);
  });

  it('should create adaptive batch processor', () => {
    const processor = createBatchProcessor({
      strategy: 'adaptive',
      maxBatchSize: 10,
      maxWaitTime: 1000,
      maxConcurrency: 2,
      processor: async () => new Map(),
      minBatchSize: 3,
      targetLatency: 100,
      scaleFactor: 1.5,
    });

    expect(processor).toBeInstanceOf(AdaptiveBatchProcessor);
  });
});
