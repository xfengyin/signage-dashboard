export interface PluginMetadata {
  name: string;
  version: string;
  author?: string;
  description?: string;
  dependencies?: string[];
  entryPoint?: string;
}

export interface PluginContext {
  pluginId: string;
  metadata: PluginMetadata;
  sandbox: PluginSandbox;
}

export interface PluginSandbox {
  globals: Record<string, unknown>;
  restrictedModules: string[];
  maxMemoryMB?: number;
}

export type PluginStatus = 'pending' | 'loading' | 'loaded' | 'active' | 'inactive' | 'error' | 'destroyed';

export interface Plugin {
  readonly metadata: PluginMetadata;
  readonly status: PluginStatus;

  init?(context: PluginContext): Promise<void> | void;
  load?(): Promise<void> | void;
  unload?(): Promise<void> | void;
  destroy?(): Promise<void> | void;

  onActivate?(): Promise<void> | void;
  onDeactivate?(): Promise<void> | void;
}

export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly parameters?: Record<string, ToolParameter>;
  execute(params: Record<string, unknown>): Promise<ToolResult> | ToolResult;
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: string[];
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface Skill {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly capabilities: string[];
  execute(context: SkillContext): Promise<SkillResult> | SkillResult;
}

export interface SkillContext {
  input: unknown;
  options?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
}

export interface SkillResult {
  success: boolean;
  output?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface RagAdapter {
  readonly name: string;
  readonly supportedMethods: string[];

  initialize?(config: RagConfig): Promise<void> | void;
  addDocuments?(documents: RagDocument[]): Promise<void> | void;
  search(query: string, options?: RagSearchOptions): Promise<RagSearchResult>;
  delete?(documentId: string): Promise<void> | void;
}

export interface RagConfig {
  provider: string;
  indexName?: string;
  embeddingModel?: string;
  options?: Record<string, unknown>;
}

export interface RagDocument {
  id?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface RagSearchOptions {
  topK?: number;
  threshold?: number;
  filter?: Record<string, unknown>;
}

export interface RagSearchResult {
  documents: RagDocument[];
  scores: number[];
  total: number;
}

export interface PluginLoaderOptions {
  pluginDir?: string;
  watchMode?: boolean;
  sandboxEnabled?: boolean;
  onLoadStart?: (pluginId: string) => void;
  onLoadComplete?: (pluginId: string, plugin: Plugin) => void;
  onError?: (pluginId: string, error: Error) => void;
}

export interface PluginRegistryOptions {
  autoInit?: boolean;
  strictMode?: boolean;
  allowDuplicates?: boolean;
}

export interface DiscoveryResult {
  plugins: PluginMetadata[];
  errors: Array<{ path: string; error: string }>;
}
