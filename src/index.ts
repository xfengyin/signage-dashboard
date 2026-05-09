/**
 * @fileOverview 企业级Agent框架 - 统一导出入口
 * @module index
 * @description 提供框架所有模块的统一导出，便捷的初始化函数和默认配置
 */

export * from './agent';
export * from './types';
export * from './utils';
export * from './constants';
export * from './middleware';

export * from './core/interfaces';
export * from './core/types';
export * from './core/constants';

export * from './config';

export * from './resilience';
export * from './observability';

export * from './spi';

import { BaseAgent, BaseAgentConfig, createAgent } from './agent';
import { ObservabilityConfig, initializeObservability } from './observability';
import { MiddlewareConfig, createDefaultMiddlewarePipeline } from './middleware';
import { AgentConfigType } from './core/types';
import { createConfigManager, ConfigManager } from './config';

export interface FrameworkConfig {
  agent?: Partial<BaseAgentConfig>;
  observability?: ObservabilityConfig;
  middleware?: MiddlewareConfig;
  configManager?: boolean;
}

export class AgentFramework {
  private config: FrameworkConfig;
  private configManager?: ConfigManager;
  private agent?: BaseAgent;

  constructor(config: FrameworkConfig = {}) {
    this.config = config;
    
    if (config.configManager) {
      this.configManager = createConfigManager();
    }
  }

  async initialize(): Promise<void> {
    if (this.configManager) {
      await this.configManager.initialize();
    }
  }

  createAgent(config?: Partial<BaseAgentConfig>): BaseAgent {
    const agentConfig: BaseAgentConfig = {
      id: config?.id || `agent_${Date.now()}`,
      name: config?.name || 'Agent',
      description: config?.description || '',
      version: config?.version || '1.0.0',
      model: config!.model!,
      config: {
        maxSteps: config?.config?.maxSteps || 100,
        executionTimeout: config?.config?.executionTimeout || 60000,
        stepTimeout: config?.config?.stepTimeout || 30000,
        streaming: config?.config?.streaming || false,
        temperature: config?.config?.temperature || 0.7,
        topP: config?.config?.topP || 1.0,
        maxTokens: config?.config?.maxTokens || 4096,
        toolTimeout: config?.config?.toolTimeout || 30000,
        maxParallelTools: config?.config?.maxParallelTools || 3,
        enableSkillMatching: config?.config?.enableSkillMatching || false,
        skillMatchThreshold: config?.config?.skillMatchThreshold || 0.7,
        ...config?.config,
      },
      observability: this.config.observability,
      middleware: this.config.middleware,
      plugins: config?.plugins,
      toolTimeout: config?.toolTimeout,
      maxConcurrentTools: config?.maxConcurrentTools,
      enableSkillMatching: config?.enableSkillMatching,
      skillMatchThreshold: config?.skillMatchThreshold,
      customContext: config?.customContext,
    };

    this.agent = createAgent(agentConfig);
    return this.agent;
  }

  getAgent(): BaseAgent | undefined {
    return this.agent;
  }

  getConfigManager(): ConfigManager | undefined {
    return this.configManager;
  }

  async cleanup(): Promise<void> {
    if (this.agent) {
      await this.agent.cleanup();
    }
  }
}

export function createFramework(config?: FrameworkConfig): AgentFramework {
  return new AgentFramework(config);
}

export async function quickStart(
  model: any,
  tools?: any[],
  options?: {
    name?: string;
    maxSteps?: number;
    enableObservability?: boolean;
  }
): Promise<BaseAgent> {
  const framework = createFramework({
    observability: options?.enableObservability ? {
      serviceName: options.name || 'quick-start-agent',
      logLevel: 'INFO',
      enableConsoleTransport: true,
    } : undefined,
  });

  const agent = framework.createAgent({
    id: `agent_${Date.now()}`,
    name: options?.name || 'QuickStartAgent',
    model,
    config: {
      maxSteps: options?.maxSteps || 50,
    },
  });

  if (tools) {
    for (const tool of tools) {
      agent.registerTool(tool);
    }
  }

  return agent;
}

export function getDefaultConfig(): AgentConfigType {
  return {
    maxSteps: 100,
    executionTimeout: 60000,
    stepTimeout: 30000,
    streaming: false,
    temperature: 0.7,
    topP: 1.0,
    maxTokens: 4096,
    toolTimeout: 30000,
    maxParallelTools: 3,
    enableSkillMatching: false,
    skillMatchThreshold: 0.7,
  };
}

export const FRAMEWORK_VERSION = '1.0.0';

export const FRAMEWORK_INFO = {
  name: 'Enterprise Agent Framework',
  version: FRAMEWORK_VERSION,
  description: 'A comprehensive framework for building enterprise-grade AI agents',
  author: 'Enterprise AI Team',
  license: 'MIT',
  repository: 'https://github.com/enterprise/agent-framework',
  documentation: 'https://docs.agent-framework.dev',
};

export default {
  AgentFramework,
  createFramework,
  BaseAgent,
  createAgent,
  quickStart,
  getDefaultConfig,
  createConfigManager,
  initializeObservability,
  createDefaultMiddlewarePipeline,
  FRAMEWORK_VERSION,
  FRAMEWORK_INFO,
};
