/**
 * @fileOverview 缓存中间件 - Agent执行过程的缓存管理中间件
 * @module middleware/cache
 * @description 提供统一的缓存管理功能，支持内存缓存、分布式缓存、缓存策略等特性
 */

import type { ExecutionContext, ExecutionResult, Middleware } from '../core/interfaces';

export interface CacheMiddlewareConfig {
  enabled?: boolean;
  cacheType?: 'memory' | 'redis' | 'memcached' | 'custom';
  ttl?: number;
  maxSize?: number;
  keyPrefix?: string;
  cacheKeyGenerator?: (context: ExecutionContext) => string;
  shouldCache?: (context: ExecutionContext, result: ExecutionResult) => boolean;
  cacheCondition?: (context: ExecutionContext) => boolean;
  evictionPolicy?: 'lru' | 'lfu' | 'fifo' | 'ttl';
  compression?: boolean;
  serialize?: (data: unknown) => string;
  deserialize?: (data: string) => unknown;
  redis?: RedisConfig;
  memcached?: MemcachedConfig;
  onCacheHit?: (key: string, context: ExecutionContext) => void;
  onCacheMiss?: (key: string, context: ExecutionContext) => void;
  onCacheError?: (error: Error, key: string, context: ExecutionContext) => void;
}

export interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  ttl?: number;
}

export interface MemcachedConfig {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  ttl?: number;
}

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  createdAt: number;
  accessedAt: number;
  accessCount: number;
  size?: number;
  metadata?: Record<string, unknown>;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
  hitRate: number;
  totalRequests: number;
  evictions: number;
  memoryUsage?: number;
}

export class CacheMiddleware implements Middleware {
  readonly name = 'CacheMiddleware';
  readonly priority = 10;
  
  private config: Required<CacheMiddlewareConfig>;
  private cache: Map<string, CacheEntry>;
  private stats: CacheStats;
  private accessOrder: string[];
  private memoryCache: Map<string, string>;
  private compressedCache: Map<string, string>;

  constructor(config: CacheMiddlewareConfig = {}) {
    this.config = {
      enabled: config.enabled !== false,
      cacheType: config.cacheType || 'memory',
      ttl: config.ttl || 300000,
      maxSize: config.maxSize || 1000,
      keyPrefix: config.keyPrefix || 'agent:',
      cacheKeyGenerator: config.cacheKeyGenerator || this.defaultKeyGenerator,
      shouldCache: config.shouldCache || (() => true),
      cacheCondition: config.cacheCondition || (() => true),
      evictionPolicy: config.evictionPolicy || 'lru',
      compression: config.compression || false,
      serialize: config.serialize || JSON.stringify,
      deserialize: config.deserialize || JSON.parse,
      redis: config.redis || {},
      memcached: config.memcached || {},
      onCacheHit: config.onCacheHit || (() => {}),
      onCacheMiss: config.onCacheMiss || (() => {}),
      onCacheError: config.onCacheError || (() => {}),
    };
    
    this.cache = new Map();
    this.accessOrder = [];
    this.memoryCache = new Map();
    this.compressedCache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      maxSize: this.config.maxSize,
      hitRate: 0,
      totalRequests: 0,
      evictions: 0,
    };
  }

  async handle(
    context: ExecutionContext,
    next: () => Promise<ExecutionResult>
  ): Promise<ExecutionResult> {
    if (!this.config.enabled) {
      return next();
    }

    if (!this.config.cacheCondition(context)) {
      return next();
    }

    const cacheKey = this.config.cacheKeyGenerator(context);
    const cachedResult = await this.get(cacheKey, context);

    if (cachedResult) {
      this.config.onCacheHit(cacheKey, context);
      this.stats.hits++;
      this.stats.totalRequests++;
      this.updateHitRate();
      
      return this.createCachedResult(cachedResult, context);
    }

    this.config.onCacheMiss(cacheKey, context);
    this.stats.misses++;
    this.stats.totalRequests++;
    this.updateHitRate();

    const result = await next();

    if (this.config.shouldCache(context, result)) {
      await this.set(cacheKey, result, context);
    }

    return result;
  }

  private defaultKeyGenerator(context: ExecutionContext): string {
    const messages = context.messages;
    const lastMessage = messages[messages.length - 1];
    const content = typeof lastMessage?.content === 'string' 
      ? lastMessage.content 
      : JSON.stringify(lastMessage?.content);
    
    const hash = this.simpleHash(content);
    return `${this.config.keyPrefix}${context.sessionId || 'default'}:${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private createCachedResult(
    cached: CacheEntry,
    context: ExecutionContext
  ): ExecutionResult {
    const result = cached.value as ExecutionResult;
    return {
      ...result,
      metadata: {
        ...result.metadata,
        cached: true,
        cacheAge: Date.now() - cached.createdAt,
        cacheKey: cached.key,
      },
    };
  }

  async get<T = unknown>(
    key: string,
    context?: ExecutionContext
  ): Promise<CacheEntry<T> | null> {
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        return null;
      }

      if (this.isExpired(entry)) {
        await this.delete(key);
        return null;
      }

      entry.accessedAt = Date.now();
      entry.accessCount++;
      
      this.updateAccessOrder(key);
      
      return entry as CacheEntry<T>;
    } catch (error) {
      this.config.onCacheError(error as Error, key, context!);
      return null;
    }
  }

  async set<T = unknown>(
    key: string,
    value: T,
    context?: ExecutionContext
  ): Promise<void> {
    try {
      if (this.cache.size >= this.config.maxSize) {
        await this.evict();
      }

      const entry: CacheEntry<T> = {
        key,
        value,
        createdAt: Date.now(),
        accessedAt: Date.now(),
        accessCount: 0,
      };

      this.cache.set(key, entry);
      this.accessOrder.push(key);
      this.stats.size++;
    } catch (error) {
      this.config.onCacheError(error as Error, key, context!);
    }
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.size--;
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }
    return deleted;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder = [];
    this.stats.size = 0;
    this.stats.evictions = 0;
  }

  private isExpired(entry: CacheEntry): boolean {
    const age = Date.now() - entry.createdAt;
    return age > this.config.ttl;
  }

  private async evict(): Promise<void> {
    let keyToEvict: string | undefined;

    switch (this.config.evictionPolicy) {
      case 'lru':
        keyToEvict = this.accessOrder.shift();
        break;
        
      case 'lfu':
        keyToEvict = this.findLeastFrequentlyUsed();
        break;
        
      case 'fifo':
        keyToEvict = this.accessOrder[0];
        break;
        
      case 'ttl':
        keyToEvict = this.findOldest();
        break;
    }

    if (keyToEvict) {
      await this.delete(keyToEvict);
      this.stats.evictions++;
    }
  }

  private findLeastFrequentlyUsed(): string | undefined {
    let minAccess = Infinity;
    let lfuKey: string | undefined;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < minAccess) {
        minAccess = entry.accessCount;
        lfuKey = key;
      }
    }

    return lfuKey;
  }

  private findOldest(): string | undefined {
    let oldestTime = Infinity;
    let oldestKey: string | undefined;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  private updateHitRate(): void {
    if (this.stats.totalRequests > 0) {
      this.stats.hitRate = this.stats.hits / this.stats.totalRequests;
    }
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      await this.delete(key);
      return false;
    }
    return true;
  }

  async keys(pattern?: string): Promise<string[]> {
    const keys = Array.from(this.cache.keys());
    if (pattern) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return keys.filter(key => regex.test(key));
    }
    return keys;
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  async getStats(): Promise<CacheStats> {
    return { ...this.stats };
  }

  async getEntry<T = unknown>(key: string): Promise<CacheEntry<T> | undefined> {
    return this.cache.get(key) as CacheEntry<T> | undefined;
  }

  async setMetadata(
    key: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const entry = this.cache.get(key);
    if (entry) {
      entry.metadata = { ...entry.metadata, ...metadata };
    }
  }

  async refresh(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (entry && !this.isExpired(entry)) {
      entry.accessedAt = Date.now();
      return true;
    }
    return false;
  }

  async refreshAll(): Promise<number> {
    let count = 0;
    const now = Date.now();
    
    for (const entry of this.cache.values()) {
      if (!this.isExpired(entry)) {
        entry.accessedAt = now;
        count++;
      }
    }
    
    return count;
  }

  async cleanup(): Promise<number> {
    let count = 0;
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      await this.delete(key);
      count++;
    }
    
    return count;
  }
}

export function createCacheMiddleware(config?: CacheMiddlewareConfig): CacheMiddleware {
  return new CacheMiddleware(config);
}

export class InMemoryCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private ttl: number;
  private accessOrder: string[];

  constructor(maxSize: number = 100, ttl: number = 300000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.accessOrder = [];
  }

  set(key: string, value: T, ttl?: number): void {
    if (this.cache.size >= this.maxSize) {
      this.evict();
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 0,
    };

    this.cache.set(key, entry);
    this.accessOrder.push(key);
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (Date.now() - entry.createdAt > (ttl || this.ttl)) {
      this.delete(key);
      return undefined;
    }

    entry.accessedAt = Date.now();
    entry.accessCount++;
    this.updateAccessOrder(key);
    
    return entry.value;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() - entry.createdAt > this.ttl) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  size(): number {
    return this.cache.size;
  }

  private evict(): void {
    if (this.accessOrder.length > 0) {
      const key = this.accessOrder.shift();
      if (key) {
        this.cache.delete(key);
      }
    }
  }

  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }
}

export function createInMemoryCache<T = unknown>(
  maxSize?: number,
  ttl?: number
): InMemoryCache<T> {
  return new InMemoryCache<T>(maxSize, ttl);
}

export class LRUCache<T = unknown> extends InMemoryCache<T> {
  constructor(maxSize: number = 100, ttl?: number) {
    super(maxSize, ttl);
  }
}

export class LFUCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>>;
  private frequencyMap: Map<number, Set<string>>;
  private minFrequency: number;
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 100, ttl: number = 300000) {
    this.cache = new Map();
    this.frequencyMap = new Map();
    this.minFrequency = 0;
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  set(key: string, value: T): void {
    if (this.cache.size >= this.maxSize) {
      this.evict();
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 1,
    };

    this.cache.set(key, entry);
    
    if (!this.frequencyMap.has(1)) {
      this.frequencyMap.set(1, new Set());
    }
    this.frequencyMap.get(1)!.add(key);
    this.minFrequency = 1;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (Date.now() - entry.createdAt > this.ttl) {
      this.delete(key);
      return undefined;
    }

    const oldFreq = entry.accessCount;
    entry.accessCount++;
    entry.accessedAt = Date.now();

    this.frequencyMap.get(oldFreq)?.delete(key);
    if (!this.frequencyMap.has(entry.accessCount)) {
      this.frequencyMap.set(entry.accessCount, new Set());
    }
    this.frequencyMap.get(entry.accessCount)!.add(key);

    this.updateMinFrequency();
    
    return entry.value;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.frequencyMap.get(entry.accessCount)?.delete(key);
      this.updateMinFrequency();
    }
    return this.cache.delete(key);
  }

  private evict(): void {
    const keysToEvict = this.frequencyMap.get(this.minFrequency);
    if (keysToEvict && keysToEvict.size > 0) {
      const key = keysToEvict.values().next().value;
      if (key) {
        this.delete(key);
      }
    }
  }

  private updateMinFrequency(): void {
    while (this.minFrequency < Infinity && 
           (!this.frequencyMap.has(this.minFrequency) || 
            this.frequencyMap.get(this.minFrequency)!.size === 0)) {
      this.minFrequency++;
    }
  }

  clear(): void {
    this.cache.clear();
    this.frequencyMap.clear();
    this.minFrequency = 0;
  }
}

export function createLFUCache<T = unknown>(
  maxSize?: number,
  ttl?: number
): LFUCache<T> {
  return new LFUCache<T>(maxSize, ttl);
}
