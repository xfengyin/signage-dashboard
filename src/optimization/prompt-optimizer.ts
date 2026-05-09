export interface TokenCount {
  prompt: number;
  completion: number;
  total: number;
}

export interface PromptSegment {
  role?: 'system' | 'user' | 'assistant';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface OptimizedPrompt {
  content: string;
  segments: PromptSegment[];
  tokenCount: TokenCount;
  metadata: {
    originalLength: number;
    optimizedLength: number;
    compressionRatio: number;
    techniques: string[];
  };
}

export interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  variables: string[];
  defaultValues?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface PromptConfig {
  maxTokens: number;
  model?: string;
  reservedCompletionTokens?: number;
  onOptimize?: (before: string, after: OptimizedPrompt) => void;
}

export interface ContextWindowConfig {
  maxTokens: number;
  priorityOrder: ('system' | 'history' | 'user' | 'context')[];
  dynamicAllocation: boolean;
}

export type CompressionStrategy = 'aggressive' | 'moderate' | 'conservative';

export interface CompressionConfig {
  strategy: CompressionStrategy;
  removeWhitespace: boolean;
  simplifyFormatting: boolean;
  truncateLongSegments: boolean;
}

export class TokenCounter {
  private static readonly CL100K_BASE_CHARS_PER_TOKEN = 4;

  static count(text: string): number {
    return Math.ceil(text.length / this.CL100K_BASE_CHARS_PER_TOKEN);
  }

  static countPrompt(segments: PromptSegment[]): number {
    return segments.reduce((sum, seg) => sum + this.count(seg.content), 0);
  }

  static canFit(text: string, maxTokens: number): boolean {
    return this.count(text) <= maxTokens;
  }

  static estimate(input: string, maxTokens: number): {
    canFit: boolean;
    overflow: number;
    truncatedText: string;
  } {
    const currentTokens = this.count(input);
    if (currentTokens <= maxTokens) {
      return { canFit: true, overflow: 0, truncatedText: input };
    }

    const charsToKeep = Math.floor(maxTokens * this.CL100K_BASE_CHARS_PER_TOKEN);
    const truncatedText = input.slice(0, charsToKeep);
    const newTokens = this.count(truncatedText);

    return {
      canFit: false,
      overflow: currentTokens - newTokens,
      truncatedText,
    };
  }
}

export class PromptCompressor {
  private static readonly WHITESPACE_REGEX = /\s+/g;
  private static readonly NEWLINE_REGEX = /\n+/g;
  private static readonly MARKUP_REGEX = /[*_`#~\[\]]/g;
  private static readonly URL_REGEX = /https?:\/\/[^\s]+/g;

  static compress(text: string, config: CompressionConfig): string {
    let result = text;

    if (config.removeWhitespace) {
      result = result.replace(this.WHITESPACE_REGEX, ' ').trim();
      result = result.replace(this.NEWLINE_REGEX, '\n');
    }

    if (config.simplifyFormatting) {
      result = result.replace(this.MARKUP_REGEX, '');
    }

    return result;
  }

  static truncate(text: string, maxTokens: number): string {
    const { truncatedText } = TokenCounter.estimate(text, maxTokens);
    return truncatedText;
  }

  static removeRedundancy(segments: PromptSegment[]): PromptSegment[] {
    const seen = new Set<string>();
    return segments.filter(seg => {
      const normalized = seg.content.toLowerCase().trim();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }

  static mergeSimilar(segments: PromptSegment[], threshold: number = 0.8): PromptSegment[] {
    if (segments.length <= 1) return segments;

    const result: PromptSegment[] = [segments[0]];
    for (let i = 1; i < segments.length; i++) {
      const current = segments[i];
      const last = result[result.length - 1];

      if (current.role === last.role && this.similarity(current.content, last.content) > threshold) {
        last.content += '\n' + current.content;
      } else {
        result.push(current);
      }
    }
    return result;
  }

  private static similarity(a: string, b: string): number {
    const aWords = new Set(a.toLowerCase().split(/\s+/));
    const bWords = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...aWords].filter(x => bWords.has(x)));
    const union = new Set([...aWords, ...bWords]);
    return intersection.size / union.size;
  }
}

export class PromptTemplateManager {
  private templates: Map<string, PromptTemplate> = new Map();
  private cache: Map<string, PromptSegment[]> = new Map();

  register(template: PromptTemplate): void {
    this.templates.set(template.id, template);
  }

  get(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  build(id: string, variables: Record<string, string>): PromptSegment[] {
    const template = this.templates.get(id);
    if (!template) throw new Error(`Template ${id} not found`);

    const cacheKey = `${id}:${JSON.stringify(variables)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const content = template.template.replace(
      /\{\{(\w+)\}\}/g,
      (_, name) => variables[name] ?? template.defaultValues?.[name] ?? `{{${name}}}`
    );

    const segments: PromptSegment[] = [{ role: 'user', content }];
    this.cache.set(cacheKey, segments);
    return segments;
  }

  buildWithHistory(
    id: string,
    variables: Record<string, string>,
    history: PromptSegment[],
    maxHistoryTokens: number
  ): PromptSegment[] {
    const template = this.templates.get(id);
    if (!template) throw new Error(`Template ${id} not found`);

    const mainSegments = this.build(id, variables);
    const mainTokens = TokenCounter.countPrompt(mainSegments);
    const availableTokens = maxHistoryTokens - mainTokens;

    let historyTokens = 0;
    const filteredHistory: PromptSegment[] = [];

    for (let i = history.length - 1; i >= 0; i--) {
      const seg = history[i];
      const segTokens = TokenCounter.count(seg.content);
      if (historyTokens + segTokens <= availableTokens) {
        filteredHistory.unshift(seg);
        historyTokens += segTokens;
      } else {
        break;
      }
    }

    return [...filteredHistory, ...mainSegments];
  }

  clearCache(): void {
    this.cache.clear();
  }

  listTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }
}

export class ContextWindowOptimizer {
  constructor(private config: ContextWindowConfig) {}

  optimize(segments: PromptSegment[], maxTokens: number): PromptSegment[] {
    const priorityMap = new Map(this.config.priorityOrder.map((p, i) => [p, i]));

    const sorted = [...segments].sort((a, b) => {
      const aPriority = priorityMap.get(a.role ?? 'user') ?? 99;
      const bPriority = priorityMap.get(b.role ?? 'user') ?? 99;
      return aPriority - bPriority;
    });

    let totalTokens = 0;
    const result: PromptSegment[] = [];

    for (const seg of sorted) {
      const segTokens = TokenCounter.count(seg.content);
      if (totalTokens + segTokens <= maxTokens) {
        result.push(seg);
        totalTokens += segTokens;
      } else {
        const remaining = maxTokens - totalTokens;
        if (remaining > 0) {
          result.push({
            ...seg,
            content: PromptCompressor.truncate(seg.content, remaining),
          });
        }
        break;
      }
    }

    return result;
  }

  estimateOptimalAllocation(
    totalTokens: number,
    reservedCompletion: number
  ): Record<string, number> {
    const availableTokens = totalTokens - reservedCompletion;
    const weights: Record<string, number> = {
      system: 0.15,
      history: 0.50,
      user: 0.25,
      context: 0.10,
    };

    return Object.fromEntries(
      Object.entries(weights).map(([key, weight]) => [
        key,
        Math.floor(availableTokens * weight),
      ])
    );
  }
}

export class PromptOptimizer {
  private config: Required<PromptConfig>;
  private compressor: typeof PromptCompressor;
  private tokenCounter: typeof TokenCounter;

  constructor(config: PromptConfig) {
    this.config = {
      maxTokens: config.maxTokens,
      model: config.model ?? 'gpt-4',
      reservedCompletionTokens: config.reservedCompletionTokens ?? 500,
      onOptimize: config.onOptimize ?? (() => {}),
    };
    this.compressor = PromptCompressor;
    this.tokenCounter = TokenCounter;
  }

  optimize(prompt: string, segments?: PromptSegment[]): OptimizedPrompt {
    const originalLength = prompt.length;
    const techniques: string[] = [];
    let content = prompt;

    const maxPromptTokens = this.config.maxTokens - this.config.reservedCompletionTokens;

    if (this.tokenCounter.count(content) > maxPromptTokens) {
      const compressionConfig: CompressionConfig = {
        strategy: 'moderate',
        removeWhitespace: true,
        simplifyFormatting: true,
        truncateLongSegments: true,
      };
      content = this.compressor.compress(content, compressionConfig);
      techniques.push('compression');
    }

    if (this.tokenCounter.count(content) > maxPromptTokens) {
      content = this.compressor.truncate(content, maxPromptTokens);
      techniques.push('truncation');
    }

    const segmentList = segments ?? [{ role: 'user' as const, content }];
    const optimizedSegments = this.compressor.removeRedundancy(segmentList);

    const optimizedContent = optimizedSegments.map(s => s.content).join('\n');
    const optimizedLength = optimizedContent.length;

    const result: OptimizedPrompt = {
      content: optimizedContent,
      segments: optimizedSegments,
      tokenCount: {
        prompt: this.tokenCounter.count(optimizedContent),
        completion: 0,
        total: this.tokenCounter.count(optimizedContent),
      },
      metadata: {
        originalLength,
        optimizedLength,
        compressionRatio: originalLength > 0 ? (1 - optimizedLength / originalLength) * 100 : 0,
        techniques,
      },
    };

    this.config.onOptimize(prompt, result);
    return result;
  }

  optimizeForContext(segments: PromptSegment[]): OptimizedPrompt {
    const maxPromptTokens = this.config.maxTokens - this.config.reservedCompletionTokens;
    const optimizer = new ContextWindowOptimizer({
      maxTokens: maxPromptTokens,
      priorityOrder: ['system', 'user', 'history', 'context'],
      dynamicAllocation: true,
    });

    const optimized = optimizer.optimize(segments, maxPromptTokens);
    const content = optimized.map(s => s.content).join('\n');

    return {
      content,
      segments: optimized,
      tokenCount: {
        prompt: this.tokenCounter.countPrompt(optimized),
        completion: 0,
        total: this.tokenCounter.count(content),
      },
      metadata: {
        originalLength: this.tokenCounter.countPrompt(segments),
        optimizedLength: this.tokenCounter.countPrompt(optimized),
        compressionRatio: 0,
        techniques: ['context-window-optimization'],
      },
    };
  }

  buildDynamicPrompt(
    baseTemplate: string,
    context: Record<string, string>,
    history?: PromptSegment[]
  ): OptimizedPrompt {
    let content = baseTemplate;
    for (const [key, value] of Object.entries(context)) {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    const segments: PromptSegment[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      ...(history ?? []),
      { role: 'user', content },
    ];

    return this.optimizeForContext(segments);
  }

  validate(prompt: string): { valid: boolean; tokenCount: number; overflow: number } {
    const maxPromptTokens = this.config.maxTokens - this.config.reservedCompletionTokens;
    const count = this.tokenCounter.count(prompt);
    return {
      valid: count <= maxPromptTokens,
      tokenCount: count,
      overflow: Math.max(0, count - maxPromptTokens),
    };
  }
}

export const defaultPromptOptimizer = new PromptOptimizer({
  maxTokens: 8192,
  reservedCompletionTokens: 500,
});

export const templateManager = new PromptTemplateManager();
