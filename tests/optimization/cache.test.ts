import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MemoryCache,
  LRUCache,
  LFUCache,
  TTLCache,
  CacheManager,
  createCache,
  globalCacheManager,
} from '../../src/optimization/cache';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache({ maxSize: 10 });
  });

  describe('set and get', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for missing keys', () => {
      expect(cache.get('missing')).toBeUndefined();
    });

    it('should update existing keys', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });
  });

  describe('delete', () => {
    it('should delete existing keys', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should return false for missing keys', () => {
      expect(cache.delete('missing')).toBe(false);
    });
  });

  describe('has', () => {
    it('should return true for existing keys', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for missing keys', () => {
      expect(cache.has('missing')).toBe(false);
    });
  });

  describe('eviction', () => {
    it('should evict least recently used when full', () => {
      const cacheWithSize = new MemoryCache({ maxSize: 3 });
      cacheWithSize.set('a', 1);
      cacheWithSize.set('b', 2);
      cacheWithSize.set('c', 3);
      cacheWithSize.get('a');
      cacheWithSize.set('d', 4);

      expect(cacheWithSize.get('b')).toBeUndefined();
      expect(cacheWithSize.get('a')).toBe(1);
    });

    it('should call onEvict callback', () => {
      const onEvict = vi.fn();
      const cacheWithCallback = new MemoryCache({
        maxSize: 2,
        onEvict,
      });

      cacheWithCallback.set('key1', 'value1');
      cacheWithCallback.set('key2', 'value2');
      cacheWithCallback.set('key3', 'value3');

      expect(onEvict).toHaveBeenCalled();
    });
  });

  describe('TTL', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(0);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should expire entries after TTL', () => {
      const ttlCache = new MemoryCache({ maxSize: 10, ttl: 5000 });

      ttlCache.set('key1', 'value1');

      vi.advanceTimersByTime(6000);

      expect(ttlCache.get('key1')).toBeUndefined();
    });

    it('should accept custom TTL per entry', () => {
      const ttlCache = new MemoryCache({ maxSize: 10, ttl: 10000 });

      ttlCache.set('key1', 'value1', 1000);

      vi.advanceTimersByTime(2000);

      expect(ttlCache.get('key1')).toBeUndefined();
    });
  });

  describe('stats', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('missing');

      const stats = cache.stats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should calculate hit rate', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key1');
      cache.get('missing');

      const stats = cache.stats();

      expect(stats.hitRate).toBeCloseTo(0.667, 1);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();

      expect(cache.size()).toBe(0);
    });
  });

  describe('invalidate', () => {
    it('should invalidate matching patterns', () => {
      cache.set('user:1', 'data1');
      cache.set('user:2', 'data2');
      cache.set('post:1', 'data3');

      const count = cache.invalidate('^user:');

      expect(count).toBe(2);
      expect(cache.get('user:1')).toBeUndefined();
      expect(cache.get('post:1')).toBe('data3');
    });
  });
});

describe('LRUCache', () => {
  let cache: LRUCache;

  beforeEach(() => {
    cache = new LRUCache({ maxSize: 3 });
  });

  it('should maintain access order', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a');
    cache.set('d', 4);

    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
  });

  it('should track keys in access order', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    expect(cache.keys()).toEqual(['a', 'b', 'c']);
  });
});

describe('LFUCache', () => {
  let cache: LFUCache;

  beforeEach(() => {
    cache = new LFUCache({ maxSize: 3 });
  });

  it('should evict least frequently used', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a');
    cache.get('a');
    cache.get('b');
    cache.set('d', 4);

    expect(cache.get('c')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
  });
});

describe('TTLCache', () => {
  let cache: TTLCache;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    cache = new TTLCache(5000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should expire entries after TTL', () => {
    cache.set('key1', 'value1');

    vi.advanceTimersByTime(6000);

    expect(cache.get('key1')).toBeUndefined();
  });

  it('should support custom TTL per entry', () => {
    cache.set('key1', 'value1', 2000);

    vi.advanceTimersByTime(3000);

    expect(cache.get('key1')).toBeUndefined();
  });

  it('should cleanup expired entries', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    vi.advanceTimersByTime(6000);

    const removed = cache.cleanup();

    expect(removed).toBe(2);
    expect(cache.size()).toBe(0);
  });
});

describe('CacheManager', () => {
  let manager: CacheManager;

  beforeEach(() => {
    manager = new CacheManager();
  });

  describe('register and get', () => {
    it('should register and retrieve caches', () => {
      const cache = new MemoryCache({ maxSize: 10 });
      manager.register('default', cache);

      expect(manager.get('default')).toBe(cache);
    });

    it('should return undefined for non-existent cache', () => {
      expect(manager.get('missing')).toBeUndefined();
    });
  });

  describe('cacheAside', () => {
    it('should load and cache on miss', async () => {
      const cache = new MemoryCache({ maxSize: 10 });
      manager.register('default', cache);
      const factory = vi.fn().mockResolvedValue('data');

      const result = await manager.cacheAside('key1', factory);

      expect(result).toBe('data');
      expect(factory).toHaveBeenCalledTimes(1);
      expect(cache.get('key1')).toBe('data');
    });

    it('should return cached value on hit', async () => {
      const cache = new MemoryCache({ maxSize: 10 });
      cache.set('key1', 'cached');
      manager.register('default', cache);
      const factory = vi.fn().mockResolvedValue('fresh');

      const result = await manager.cacheAside('key1', factory);

      expect(result).toBe('cached');
      expect(factory).not.toHaveBeenCalled();
    });
  });

  describe('readThrough', () => {
    it('should load through to cache on miss', async () => {
      const cache = new MemoryCache({ maxSize: 10 });
      manager.register('default', cache);
      const factory = vi.fn().mockResolvedValue('data');

      const result = await manager.readThrough('key1', factory);

      expect(result).toBe('data');
      expect(cache.get('key1')).toBe('data');
    });
  });

  describe('writeThrough', () => {
    it('should write to cache and factory', async () => {
      const cache = new MemoryCache({ maxSize: 10 });
      manager.register('default', cache);
      const writeFactory = vi.fn();

      await manager.writeThrough('key1', 'data', writeFactory);

      expect(writeFactory).toHaveBeenCalledWith('data');
      expect(cache.get('key1')).toBe('data');
    });
  });

  describe('invalidate', () => {
    it('should invalidate by pattern', () => {
      const cache = new MemoryCache({ maxSize: 10 });
      cache.set('user:1', 'data1');
      cache.set('user:2', 'data2');
      cache.set('post:1', 'data3');
      manager.register('default', cache);

      const count = manager.invalidate('^user:');

      expect(count).toBe(2);
    });

    it('should invalidate specific cache', () => {
      const cache1 = new MemoryCache({ maxSize: 10 });
      const cache2 = new MemoryCache({ maxSize: 10 });
      cache1.set('key', 'data1');
      cache2.set('key', 'data2');
      manager.register('cache1', cache1);
      manager.register('cache2', cache2);

      manager.invalidate('key', 'cache1');

      expect(cache1.get('key')).toBeUndefined();
      expect(cache2.get('key')).toBe('data2');
    });
  });

  describe('getAllStats', () => {
    it('should return stats for all caches', () => {
      const cache1 = new MemoryCache({ maxSize: 10 });
      const cache2 = new MemoryCache({ maxSize: 10 });
      cache1.set('key1', 'value1');
      cache2.set('key2', 'value2');
      manager.register('cache1', cache1);
      manager.register('cache2', cache2);

      const stats = manager.getAllStats();

      expect(stats.cache1).toBeDefined();
      expect(stats.cache2).toBeDefined();
    });
  });
});

describe('createCache', () => {
  it('should create LRU cache', () => {
    const cache = createCache('lru', { maxSize: 10 });

    expect(cache).toBeInstanceOf(LRUCache);
  });

  it('should create LFU cache', () => {
    const cache = createCache('lfu', { maxSize: 10 });

    expect(cache).toBeInstanceOf(LFUCache);
  });

  it('should create TTL cache', () => {
    const cache = createCache('ttl', { maxSize: 10, ttl: 5000 });

    expect(cache).toBeInstanceOf(TTLCache);
  });

  it('should create memory cache by default', () => {
    const cache = createCache('memory', { maxSize: 10 });

    expect(cache).toBeInstanceOf(MemoryCache);
  });
});

describe('globalCacheManager', () => {
  it('should be available globally', () => {
    expect(globalCacheManager).toBeInstanceOf(CacheManager);
  });
});
