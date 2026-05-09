export type CacheKey = string;
export type CacheValue = unknown;
export type CacheMetadata = {
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  size: number;
};

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

export interface CacheConfig {
  maxSize: number;
  ttl?: number;
  onEvict?: (key: CacheKey, value: CacheValue) => void;
  onHit?: (key: CacheKey) => void;
  onMiss?: (key: CacheKey) => void;
}

export interface Cache {
  get(key: CacheKey): CacheValue | undefined;
  set(key: CacheKey, value: CacheValue, ttl?: number): void;
  delete(key: CacheKey): boolean;
  has(key: CacheKey): boolean;
  clear(): void;
  size(): number;
  keys(): CacheKey[];
  stats(): CacheStats;
  invalidate(pattern: string): number;
}

export interface DistributedCache extends Cache {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getOrSet<T>(key: CacheKey, factory: () => T | Promise<T>, ttl?: number): Promise<T>;
  mget<T>(keys: CacheKey[]): Promise<(T | undefined)[]>;
  mset(entries: Array<{ key: CacheKey; value: CacheValue; ttl?: number }>): Promise<void>;
  mdel(keys: CacheKey[]): Promise<void>;
}

export type EvictionPolicy = 'lru' | 'lfu' | 'ttl' | 'fifo';
export type CacheStrategy = 'cache-aside' | 'read-through' | 'write-through';

export interface CacheStrategyConfig {
  strategy: CacheStrategy;
  cache: Cache;
  ttl?: number;
  refreshInterval?: number;
  onError?: (error: Error) => void;
}

export class MemoryCache implements Cache {
  private store: Map<CacheKey, { value: CacheValue; metadata: CacheMetadata; ttl?: number }>;
  private config: Required<CacheConfig>;
  private stats: CacheStats;

  constructor(config: CacheConfig) {
    this.store = new Map();
    this.config = {
      maxSize: config.maxSize,
      ttl: config.ttl ?? 0,
      onEvict: config.onEvict ?? (() => {}),
      onHit: config.onHit ?? (() => {}),
      onMiss: config.onMiss ?? (() => {}),
    };
    this.stats = { hits: 0, misses: 0, evictions: 0, size: 0, hitRate: 0 };
  }

  get(key: CacheKey): CacheValue | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.stats.misses++;
      this.config.onMiss(key);
      this.updateHitRate();
      return undefined;
    }
    if (entry.ttl && Date.now() > entry.metadata.createdAt + entry.ttl) {
      this.delete(key);
      this.stats.misses++;
      this.config.onMiss(key);
      this.updateHitRate();
      return undefined;
    }
    entry.metadata.lastAccessedAt = Date.now();
    entry.metadata.accessCount++;
    this.stats.hits++;
    this.config.onHit(key);
    this.updateHitRate();
    return entry.value;
  }

  set(key: CacheKey, value: CacheValue, ttl?: number): void {
    if (this.store.size >= this.config.maxSize && !this.store.has(key)) {
      this.evictOne();
    }
    const now = Date.now();
    const existing = this.store.get(key);
    this.store.set(key, {
      value,
      metadata: existing?.metadata ?? {
        createdAt: now,
        lastAccessedAt: now,
        accessCount: 0,
        size: this.estimateSize(value),
      },
      ttl: ttl ?? this.config.ttl,
    });
  }

  delete(key: CacheKey): boolean {
    const entry = this.store.get(key);
    if (entry) {
      this.config.onEvict(key, entry.value);
      this.store.delete(key);
      this.stats.size--;
      return true;
    }
    return false;
  }

  has(key: CacheKey): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.ttl && Date.now() > entry.metadata.createdAt + entry.ttl) {
      this.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.store.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0, size: 0, hitRate: 0 };
  }

  size(): number {
    return this.store.size;
  }

  keys(): CacheKey[] {
    return Array.from(this.store.keys());
  }

  stats(): CacheStats {
    return { ...this.stats };
  }

  invalidate(pattern: string): number {
    const regex = new RegExp(pattern);
    let count = 0;
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.delete(key);
        count++;
      }
    }
    return count;
  }

  private evictOne(): void {
    let oldestKey: CacheKey | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.store.entries()) {
      if (entry.metadata.lastAccessedAt < oldestTime) {
        oldestTime = entry.metadata.lastAccessedAt;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      this.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private estimateSize(value: CacheValue): number {
    return JSON.stringify(value).length;
  }
}

export class LRUCache implements Cache {
  private cache: MemoryCache;
  private accessOrder: CacheKey[];
  private maxSize: number;

  constructor(config: CacheConfig) {
    this.maxSize = config.maxSize;
    this.cache = new MemoryCache({
      ...config,
      onEvict: (key, value) => {
        this.accessOrder = this.accessOrder.filter(k => k !== key);
        config.onEvict?.(key, value);
      },
    });
    this.accessOrder = [];
  }

  get(key: CacheKey): CacheValue | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.accessOrder.push(key);
    }
    return value;
  }

  set(key: CacheKey, value: CacheValue, ttl?: number): void {
    if (!this.cache.has(key)) {
      if (this.accessOrder.length >= this.maxSize) {
        const oldest = this.accessOrder.shift();
        if (oldest) this.cache.delete(oldest);
      }
      this.accessOrder.push(key);
    }
    this.cache.set(key, value, ttl);
  }

  delete(key: CacheKey): boolean {
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    return this.cache.delete(key);
  }

  has(key: CacheKey): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.accessOrder = [];
    this.cache.clear();
  }

  size(): number {
    return this.cache.size();
  }

  keys(): CacheKey[] {
    return [...this.accessOrder];
  }

  stats(): CacheStats {
    return this.cache.stats();
  }

  invalidate(pattern: string): number {
    const regex = new RegExp(pattern);
    const toDelete = this.accessOrder.filter(k => regex.test(k));
    for (const key of toDelete) {
      this.delete(key);
    }
    return toDelete.length;
  }
}

export class LFUCache implements Cache {
  private cache: Map<CacheKey, { value: CacheValue; metadata: CacheMetadata; ttl?: number }>;
  private freqList: Map<number, Set<CacheKey>>;
  private minFreq: number;
  private config: Required<CacheConfig>;

  constructor(config: CacheConfig) {
    this.cache = new Map();
    this.freqList = new Map([[1, new Set()]]);
    this.minFreq = 1;
    this.config = {
      maxSize: config.maxSize,
      ttl: config.ttl ?? 0,
      onEvict: config.onEvict ?? (() => {}),
      onHit: config.onHit ?? (() => {}),
      onMiss: config.onMiss ?? (() => {}),
    };
  }

  get(key: CacheKey): CacheValue | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.config.onMiss(key);
      return undefined;
    }
    if (entry.ttl && Date.now() > entry.metadata.createdAt + entry.ttl) {
      this.delete(key);
      this.config.onMiss(key);
      return undefined;
    }
    const oldFreq = entry.metadata.accessCount;
    entry.metadata.accessCount++;
    entry.metadata.lastAccessedAt = Date.now();
    this.freqList.get(oldFreq)?.delete(key);
    if (!this.freqList.has(entry.metadata.accessCount)) {
      this.freqList.set(entry.metadata.accessCount, new Set());
    }
    this.freqList.get(entry.metadata.accessCount)!.add(key);
    if (oldFreq === this.minFreq && this.freqList.get(oldFreq)?.size === 0) {
      this.minFreq++;
    }
    this.config.onHit(key);
    return entry.value;
  }

  set(key: CacheKey, value: CacheValue, ttl?: number): void {
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      entry.value = value;
      entry.ttl = ttl ?? this.config.ttl;
      this.get(key);
      return;
    }
    if (this.cache.size >= this.config.maxSize) {
      const victims = this.freqList.get(this.minFreq);
      if (victims && victims.size > 0) {
        const victim = victims.values().next().value;
        if (victim) this.delete(victim);
      }
    }
    const now = Date.now();
    this.cache.set(key, {
      value,
      metadata: { createdAt: now, lastAccessedAt: now, accessCount: 1, size: 0 },
      ttl: ttl ?? this.config.ttl,
    });
    this.freqList.get(1)!.add(key);
    this.minFreq = 1;
  }

  delete(key: CacheKey): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.config.onEvict(key, entry.value);
      this.freqList.get(entry.metadata.accessCount)?.delete(key);
      this.cache.delete(key);
      return true;
    }
    return false;
  }

  has(key: CacheKey): boolean {
    return this.get(key) !== undefined;
  }

  clear(): void {
    this.cache.clear();
    this.freqList = new Map([[1, new Set()]]);
    this.minFreq = 1;
  }

  size(): number {
    return this.cache.size;
  }

  keys(): CacheKey[] {
    return Array.from(this.cache.keys());
  }

  stats(): CacheStats {
    return { hits: 0, misses: 0, evictions: 0, size: this.cache.size, hitRate: 0 };
  }

  invalidate(pattern: string): number {
    const regex = new RegExp(pattern);
    let count = 0;
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
        count++;
      }
    }
    return count;
  }
}

export class TTLCache implements Cache {
  private cache: Map<CacheKey, { value: CacheValue; expiresAt: number }>;

  constructor(private defaultTtl: number) {
    this.cache = new Map();
  }

  get(key: CacheKey): CacheValue | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: CacheKey, value: CacheValue, ttl?: number): void {
    const actualTtl = ttl ?? this.defaultTtl;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + actualTtl,
    });
  }

  delete(key: CacheKey): boolean {
    return this.cache.delete(key);
  }

  has(key: CacheKey): boolean {
    return this.get(key) !== undefined;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  keys(): CacheKey[] {
    return Array.from(this.cache.keys());
  }

  stats(): CacheStats {
    return { hits: 0, misses: 0, evictions: 0, size: this.cache.size, hitRate: 0 };
  }

  invalidate(pattern: string): number {
    const regex = new RegExp(pattern);
    let count = 0;
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  cleanup(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }
}

export class CacheManager {
  private caches: Map<string, Cache> = new Map();
  private strategies: Map<string, CacheStrategyConfig> = new Map();

  register(name: string, cache: Cache): void {
    this.caches.set(name, cache);
  }

  get(name: string): Cache | undefined {
    return this.caches.get(name);
  }

  registerStrategy(name: string, config: CacheStrategyConfig): void {
    this.strategies.set(name, config);
  }

  async cacheAside<T>(
    key: CacheKey,
    factory: () => T | Promise<T>,
    cacheName: string = 'default',
    ttl?: number
  ): Promise<T> {
    const cache = this.caches.get(cacheName);
    if (!cache) throw new Error(`Cache ${cacheName} not found`);

    const cached = cache.get(key);
    if (cached !== undefined) return cached as T;

    const value = await Promise.resolve(factory());
    cache.set(key, value, ttl);
    return value;
  }

  async readThrough<T>(
    key: CacheKey,
    factory: () => T | Promise<T>,
    cacheName: string = 'default',
    ttl?: number
  ): Promise<T> {
    const cache = this.caches.get(cacheName);
    if (!cache) throw new Error(`Cache ${cacheName} not found`);

    if (cache.has(key)) {
      return cache.get(key) as T;
    }

    const value = await Promise.resolve(factory());
    cache.set(key, value, ttl);
    return value;
  }

  async writeThrough<T>(
    key: CacheKey,
    value: T,
    writeFactory: (value: T) => void | Promise<void>,
    cacheName: string = 'default',
    ttl?: number
  ): Promise<T> {
    const cache = this.caches.get(cacheName);
    if (!cache) throw new Error(`Cache ${cacheName} not found`);

    await Promise.resolve(writeFactory(value));
    cache.set(key, value, ttl);
    return value;
  }

  async refresh(key: CacheKey, factory: () => unknown, cacheName: string = 'default'): Promise<void> {
    const cache = this.caches.get(cacheName);
    if (!cache) throw new Error(`Cache ${cacheName} not found`);

    const value = await Promise.resolve(factory());
    cache.set(key, value);
  }

  invalidate(pattern: string, cacheName?: string): number {
    if (cacheName) {
      const cache = this.caches.get(cacheName);
      return cache ? cache.invalidate(pattern) : 0;
    }
    let total = 0;
    for (const cache of this.caches.values()) {
      total += cache.invalidate(pattern);
    }
    return total;
  }

  getAllStats(): Record<string, CacheStats> {
    const result: Record<string, CacheStats> = {};
    for (const [name, cache] of this.caches) {
      result[name] = cache.stats();
    }
    return result;
  }

  startAutoRefresh(intervalMs: number): () => void {
    const timer = setInterval(() => {
      for (const cache of this.caches.values()) {
        if (cache instanceof TTLCache) {
          (cache as TTLCache).cleanup();
        }
      }
    }, intervalMs);
    return () => clearInterval(timer);
  }
}

export const createCache = (type: 'lru' | 'lfu' | 'ttl' | 'memory', config: CacheConfig): Cache => {
  switch (type) {
    case 'lru':
      return new LRUCache(config);
    case 'lfu':
      return new LFUCache(config);
    case 'ttl':
      return new TTLCache(config.ttl ?? 60000);
    default:
      return new MemoryCache(config);
  }
};

export const globalCacheManager = new CacheManager();
