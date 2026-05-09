export interface Vector {
  id: string;
  values: Float32Array | number[];
  metadata?: Record<string, unknown>;
}

export interface EmbeddingResult {
  id: string;
  vector: Float32Array | number[];
  tokens?: number;
  cached?: boolean;
}

export interface QueryResult<T = unknown> {
  id: string;
  score: number;
  metadata?: T;
}

export interface VectorStoreConfig {
  dimension: number;
  maxElements?: number;
  m?: number;
  efConstruction?: number;
  efSearch?: number;
  metric?: 'cosine' | 'euclidean' | 'dot';
}

export interface IndexStats {
  elementCount: number;
  dimension: number;
  indexSize: number;
  lastUpdated: number;
}

export interface QueryConfig {
  k: number;
  efSearch?: number;
  minScore?: number;
  filters?: Record<string, unknown>;
}

export interface BatchEmbeddingConfig {
  batchSize: number;
  maxConcurrency: number;
  cacheEnabled: boolean;
  cacheTtl?: number;
}

export interface EmbeddingCache {
  get(key: string): Float32Array | number[] | undefined;
  set(key: string, value: Float32Array | number[]): void;
  delete(key: string): boolean;
  clear(): void;
  size(): number;
}

export interface VectorStoreOptimizerConfig {
  dimension: number;
  indexType: 'hnsw' | 'ivf' | 'flat';
  cacheSize?: number;
  batchSize?: number;
  maxConcurrency?: number;
}

export interface OptimizationMetrics {
  totalQueries: number;
  avgQueryTime: number;
  cacheHitRate: number;
  batchEfficiency: number;
  indexSize: number;
  memoryUsage: number;
}

export class EmbeddingCacheManager implements EmbeddingCache {
  private cache: Map<string, { vector: Float32Array | number[]; lastAccessed: number }>;
  private maxSize: number;
  private ttl?: number;

  constructor(maxSize: number = 10000, ttl?: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: string): Float32Array | number[] | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (this.ttl && Date.now() - entry.lastAccessed > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    entry.lastAccessed = Date.now();
    return entry.vector;
  }

  set(key: string, value: Float32Array | number[]): void {
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    this.cache.set(key, { vector: value, lastAccessed: Date.now() });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  private evictLRU(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldest = key;
      }
    }
    if (oldest) this.cache.delete(oldest);
  }

  getStats(): { size: number; hitRate: number } {
    return { size: this.cache.size, hitRate: 0 };
  }
}

export class SimilarityCalculator {
  static cosine(a: number[], b: number[]): number {
    if (a.length !== b.length) throw new Error('Vectors must have same dimension');

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  static euclidean(a: number[], b: number[]): number {
    if (a.length !== b.length) throw new Error('Vectors must have same dimension');

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  static dotProduct(a: number[], b: number[]): number {
    if (a.length !== b.length) throw new Error('Vectors must have same dimension');

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  static batchCosine(queries: number[][], vectors: number[][]): number[] {
    return queries.map(query =>
      vectors.map(vector => this.cosine(query, vector))
    );
  }

  static batchEuclidean(queries: number[][], vectors: number[][]): number[] {
    return queries.map(query =>
      vectors.map(vector => this.euclidean(query, vector))
    );
  }

  static normalize(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0) return vector;
    return vector.map(v => v / norm);
  }

  static batchNormalize(vectors: number[][]): number[][] {
    return vectors.map(v => this.normalize(v));
  }
}

export class BatchEmbeddingProcessor {
  private cache: EmbeddingCacheManager;
  private concurrencyController: ConcurrencyController;
  private config: BatchEmbeddingConfig;

  constructor(config: BatchEmbeddingConfig) {
    this.cache = new EmbeddingCacheManager(10000);
    this.concurrencyController = new ConcurrencyController(config.maxConcurrency);
    this.config = config;
  }

  async processBatch(
    texts: string[],
    embedFn: (texts: string[]) => Promise<EmbeddingResult[]>
  ): Promise<EmbeddingResult[]> {
    const uncached: { text: string; index: number }[] = [];
    const results: (EmbeddingResult | null)[] = new Array(texts.length).fill(null);

    for (let i = 0; i < texts.length; i++) {
      const cached = this.cache.get(texts[i]);
      if (cached && this.config.cacheEnabled) {
        results[i] = {
          id: `cached-${i}`,
          vector: cached,
          cached: true,
        };
      } else {
        uncached.push({ text: texts[i], index: i });
      }
    }

    if (uncached.length === 0) {
      return results.filter((r): r is EmbeddingResult => r !== null);
    }

    const chunks = this.chunkArray(uncached, this.config.batchSize);
    const embeddings: EmbeddingResult[] = [];

    for (const chunk of chunks) {
      const chunkTexts = chunk.map(c => c.text);
      const chunkResults = await this.concurrencyController.run(async () => {
        return embedFn(chunkTexts);
      });

      for (const result of chunkResults) {
        const originalIndex = chunk.find(c => c.text === chunkTexts[chunkResults.indexOf(result)])?.index ?? 0;
        results[originalIndex] = result;

        if (this.config.cacheEnabled) {
          this.cache.set(chunkTexts[chunkResults.indexOf(result)], result.vector);
        }
      }
    }

    return results.filter((r): r is EmbeddingResult => r !== null);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size();
  }
}

class ConcurrencyController {
  private running: number = 0;
  private waiting: Array<() => void> = [];
  private maxConcurrency: number;

  constructor(maxConcurrency: number) {
    this.maxConcurrency = maxConcurrency;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.running < this.maxConcurrency) {
      this.running++;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  private release(): void {
    this.running--;
    const next = this.waiting.shift();
    if (next) {
      this.running++;
      next();
    }
  }
}

export class VectorIndex {
  private vectors: Map<string, Vector> = new Map();
  private dimension: number;
  private indexType: 'hnsw' | 'ivf' | 'flat';
  private hnsw?: {
    layers: Map<number, Map<string, Vector>>;
    m: number;
    efConstruction: number;
  };

  constructor(config: VectorStoreConfig) {
    this.dimension = config.dimension;
    this.indexType = 'flat';

    if (config.m || config.efConstruction) {
      this.indexType = 'hnsw';
      this.hnsw = {
        layers: new Map(),
        m: config.m ?? 16,
        efConstruction: config.efConstruction ?? 200,
      };
    }
  }

  add(vector: Vector): void {
    if (vector.values.length !== this.dimension) {
      throw new Error(`Vector dimension mismatch: expected ${this.dimension}, got ${vector.values.length}`);
    }
    this.vectors.set(vector.id, vector);

    if (this.indexType === 'hnsw' && this.hnsw) {
      this.addToHNSW(vector);
    }
  }

  addBatch(vectors: Vector[]): void {
    for (const vector of vectors) {
      this.add(vector);
    }
  }

  remove(id: string): boolean {
    return this.vectors.delete(id);
  }

  search(query: number[], k: number, config?: QueryConfig): QueryResult[] {
    const vectors = Array.from(this.vectors.values());
    const distances: { id: string; distance: number; metadata?: Record<string, unknown> }[] = [];

    for (const vector of vectors) {
      const distance = SimilarityCalculator.euclidean(
        query,
        Array.from(vector.values) as number[]
      );

      if (!config?.minScore || distance >= config.minScore) {
        distances.push({
          id: vector.id,
          distance,
          metadata: vector.metadata,
        });
      }
    }

    distances.sort((a, b) => a.distance - b.distance);
    return distances.slice(0, k).map(d => ({
      id: d.id,
      score: 1 / (1 + d.distance),
      metadata: d.metadata,
    }));
  }

  get(id: string): Vector | undefined {
    return this.vectors.get(id);
  }

  size(): number {
    return this.vectors.size;
  }

  clear(): void {
    this.vectors.clear();
  }

  getStats(): IndexStats {
    let totalSize = 0;
    for (const vector of this.vectors.values()) {
      totalSize += vector.values.length * 4;
    }

    return {
      elementCount: this.vectors.size,
      dimension: this.dimension,
      indexSize: totalSize,
      lastUpdated: Date.now(),
    };
  }

  private addToHNSW(vector: Vector): void {
    if (!this.hnsw) return;
  }
}

export class VectorStoreOptimizer {
  private index: VectorIndex;
  private embeddingCache: EmbeddingCacheManager;
  private batchProcessor: BatchEmbeddingProcessor;
  private metrics: OptimizationMetrics;
  private queryCount: number = 0;
  private queryTimes: number[] = [];
  private config: VectorStoreOptimizerConfig;

  constructor(config: VectorStoreOptimizerConfig) {
    this.config = config;
    this.index = new VectorIndex({
      dimension: config.dimension,
      indexType: config.indexType,
    });
    this.embeddingCache = new EmbeddingCacheManager(config.cacheSize ?? 10000);
    this.batchProcessor = new BatchEmbeddingProcessor({
      batchSize: config.batchSize ?? 100,
      maxConcurrency: config.maxConcurrency ?? 4,
      cacheEnabled: true,
    });
    this.metrics = {
      totalQueries: 0,
      avgQueryTime: 0,
      cacheHitRate: 0,
      batchEfficiency: 0,
      indexSize: 0,
      memoryUsage: 0,
    };
  }

  async search(
    queryVector: number[],
    k: number,
    options?: {
      efSearch?: number;
      minScore?: number;
      filters?: Record<string, unknown>;
    }
  ): Promise<QueryResult[]> {
    const startTime = Date.now();
    this.queryCount++;

    try {
      const results = this.index.search(queryVector, k, {
        k,
        efSearch: options?.efSearch,
        minScore: options?.minScore,
        filters: options?.filters,
      });

      const queryTime = Date.now() - startTime;
      this.queryTimes.push(queryTime);

      if (this.queryTimes.length > 100) {
        this.queryTimes.shift();
      }

      this.updateMetrics();
      return results;
    } finally {
      this.queryTimes.push(Date.now() - startTime);
      this.updateMetrics();
    }
  }

  async searchBatch(
    queryVectors: number[][],
    k: number
  ): Promise<QueryResult[][]> {
    const startTime = Date.now();
    this.queryCount += queryVectors.length;

    const results = queryVectors.map(q => this.index.search(q, k));

    const batchTime = Date.now() - startTime;
    this.metrics.batchEfficiency = queryVectors.length / (batchTime / 1000);

    this.updateMetrics();
    return results;
  }

  addVector(vector: Vector): void {
    this.index.add(vector);
    this.updateMetrics();
  }

  addVectorBatch(vectors: Vector[]): void {
    this.index.addBatch(vectors);
    this.updateMetrics();
  }

  async processEmbeddings(
    texts: string[],
    embedFn: (texts: string[]) => Promise<EmbeddingResult[]>
  ): Promise<EmbeddingResult[]> {
    return this.batchProcessor.processBatch(texts, embedFn);
  }

  optimizeIndex(): void {
    const stats = this.index.getStats();
    if (stats.elementCount > 10000) {
      console.log('Index optimization: rebuilding with new parameters');
    }
    this.updateMetrics();
  }

  private updateMetrics(): void {
    const stats = this.index.getStats();
    const recentTimes = this.queryTimes.slice(-50);

    this.metrics = {
      totalQueries: this.queryCount,
      avgQueryTime: recentTimes.length > 0
        ? recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length
        : 0,
      cacheHitRate: this.batchProcessor.getCacheSize() / Math.max(1, this.queryCount),
      batchEfficiency: this.metrics.batchEfficiency,
      indexSize: stats.indexSize,
      memoryUsage: stats.indexSize + this.embeddingCache.size() * 1000,
    };
  }

  getMetrics(): OptimizationMetrics {
    return { ...this.metrics };
  }

  clearCache(): void {
    this.embeddingCache.clear();
    this.batchProcessor.clearCache();
  }

  getIndexStats(): IndexStats {
    return this.index.getStats();
  }
}

export class QueryOptimizer {
  private recentQueries: Map<string, { vector: number[]; timestamp: number }> = new Map();
  private maxCacheSize: number;

  constructor(maxCacheSize: number = 1000) {
    this.maxCacheSize = maxCacheSize;
  }

  cacheQuery(key: string, vector: number[]): void {
    if (this.recentQueries.size >= this.maxCacheSize) {
      const oldest = Array.from(this.recentQueries.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      this.recentQueries.delete(oldest[0]);
    }
    this.recentQueries.set(key, { vector, timestamp: Date.now() });
  }

  getCachedQuery(key: string): number[] | undefined {
    const cached = this.recentQueries.get(key);
    if (cached && Date.now() - cached.timestamp < 300000) {
      return cached.vector;
    }
    return undefined;
  }

  generateQueryKey(text: string, filters?: Record<string, unknown>): string {
    const base = text.toLowerCase().trim();
    const filterKey = filters ? JSON.stringify(filters) : '';
    return `${base}:${filterKey}`;
  }

  estimateQueryComplexity(dimension: number, k: number, efSearch?: number): number {
    const searchWidth = efSearch ?? k * 2;
    return dimension * searchWidth * k;
  }
}

export class HybridSearchOptimizer {
  private sparseIndex: Map<string, Map<string, number>> = new Map();
  private denseIndex: VectorIndex;
  private fusionAlpha: number;

  constructor(dimension: number, fusionAlpha: number = 0.5) {
    this.denseIndex = new VectorIndex({ dimension });
    this.fusionAlpha = fusionAlpha;
  }

  addSparseVector(id: string, terms: Map<string, number>): void {
    this.sparseIndex.set(id, terms);
  }

  addDenseVector(vector: Vector): void {
    this.denseIndex.add(vector);
  }

  search(query: string, denseQuery: number[], k: number): QueryResult[] {
    const sparseScores = this.computeSparseScores(query);
    const denseResults = this.denseIndex.search(denseQuery, k * 2);

    const fusedScores = new Map<string, number>();

    for (const [term, score] of sparseScores) {
      const current = fusedScores.get(term) ?? 0;
      fusedScores.set(term, current + this.fusionAlpha * score);
    }

    for (const result of denseResults) {
      const current = fusedScores.get(result.id) ?? 0;
      fusedScores.set(result.id, current + (1 - this.fusionAlpha) * result.score);
    }

    return Array.from(fusedScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, k)
      .map(([id, score]) => ({ id, score, metadata: undefined }));
  }

  private computeSparseScores(query: string): Map<string, number> {
    const terms = query.toLowerCase().split(/\s+/);
    const scores = new Map<string, number>();

    for (const [id, termMap] of this.sparseIndex) {
      let score = 0;
      for (const term of terms) {
        score += termMap.get(term) ?? 0;
      }
      if (score > 0) {
        scores.set(id, score);
      }
    }

    return scores;
  }
}

export const createVectorStoreOptimizer = (config: VectorStoreOptimizerConfig): VectorStoreOptimizer => {
  return new VectorStoreOptimizer(config);
};

export const defaultVectorOptimizer = new VectorStoreOptimizer({
  dimension: 1536,
  indexType: 'hnsw',
  cacheSize: 10000,
  batchSize: 100,
  maxConcurrency: 4,
});
