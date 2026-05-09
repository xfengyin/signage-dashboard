import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAgent, BaseAgent } from '../../src/agent';
import type { Tool, Model, ExecutionResult } from '../../src/core/interfaces';

describe('Agent', () => {
  let mockModel: Model;
  let mockTool: Tool;

  beforeEach(() => {
    mockModel = {
      name: 'test-model',
      type: 'chat',
      async generate() {
        return {
          content: 'Test response',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          finishReason: 'stop',
        };
      },
      async *stream() {
        yield { delta: 'Test', done: false };
        yield { delta: ' response', done: true };
      },
      async embed() {
        return { embeddings: [[0.1, 0.2]] };
      },
    };

    mockTool = {
      name: 'test-tool',
      description: 'A test tool',
      async validate() {
        return true;
      },
      async execute() {
        return { result: 'success' };
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createAgent', () => {
    it('should create agent instance', () => {
      const agent = createAgent({
        id: 'test-agent',
        name: 'Test Agent',
        model: mockModel,
      });

      expect(agent).toBeInstanceOf(BaseAgent);
      expect(agent.id).toBe('test-agent');
      expect(agent.name).toBe('Test Agent');
    });

    it('should use default config values', () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
      });

      expect(agent.config.maxSteps).toBe(100);
      expect(agent.config.executionTimeout).toBe(60000);
    });

    it('should accept custom config', () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
        config: {
          maxSteps: 50,
          temperature: 0.5,
        },
      });

      expect(agent.config.maxSteps).toBe(50);
      expect(agent.config.temperature).toBe(0.5);
    });

    it('should accept retry config', () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
        retryConfig: {
          maxRetries: 5,
          initialDelay: 2000,
        },
      });

      const resilientClient = agent.getResilientClient();
      expect(resilientClient).toBeDefined();
    });

    it('should accept rate limit config', () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
        rateLimitConfig: {
          maxRequests: 100,
          windowMs: 60000,
        },
      });

      expect(agent).toBeInstanceOf(BaseAgent);
    });

    it('should accept circuit breaker config', () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
        circuitBreakerConfig: {
          failureThreshold: 10,
          successThreshold: 3,
        },
      });

      expect(agent).toBeInstanceOf(BaseAgent);
    });

    it('should accept tool timeout', () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
        toolTimeout: 10000,
      });

      expect(agent).toBeDefined();
    });

    it('should accept max concurrent tools', () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
        maxConcurrentTools: 5,
      });

      expect(agent).toBeDefined();
    });
  });

  describe('registerTool', () => {
    it('should register tools', () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
      });

      agent.registerTool(mockTool);

      const tools = agent.getTools();

      expect(tools).toContain(mockTool);
    });

    it('should allow removing tools', () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
      });

      agent.registerTool(mockTool);
      const removed = agent.removeTool('test-tool');

      expect(removed).toBe(true);
      expect(agent.getTools()).toHaveLength(0);
    });
  });

  describe('registerSkill', () => {
    it('should register skills', () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
      });

      const mockSkill = {
        id: 'test-skill',
        name: 'Test Skill',
        description: 'A test skill',
        version: '1.0.0',
        async execute() {
          return { status: 'success' as const };
        },
      };

      agent.registerSkill(mockSkill);

      const skills = agent.getSkills();

      expect(skills).toContain(mockSkill);
    });

    it('should allow removing skills', () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
      });

      const skill = {
        id: 'test-skill',
        name: 'Test',
        description: '',
        version: '1.0.0',
        async execute() { return { status: 'success' as const }; },
      };

      agent.registerSkill(skill);
      const removed = agent.removeSkill('test-skill');

      expect(removed).toBe(true);
      expect(agent.getSkills()).toHaveLength(0);
    });
  });

  describe('execute', () => {
    it('should execute with string input', async () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
      });

      const result = await agent.execute('Hello');

      expect(result.status).toBeDefined();
      expect(result.output).toBeDefined();
    });

    it('should track tool calls', async () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
      });

      agent.registerTool(mockTool);

      const result = await agent.execute('Use test tool');

      expect(result.toolCalls).toBeDefined();
    });
  });

  describe('getState', () => {
    it('should return agent state', async () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
      });

      const state = await agent.getState();

      expect(state.status).toBe('idle');
      expect(state.lastActiveAt).toBeInstanceOf(Date);
    });
  });

  describe('reset', () => {
    it('should reset agent state', async () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
      });

      await agent.reset();
      const state = await agent.getState();

      expect(state.status).toBe('idle');
      expect(state.currentRequestId).toBeUndefined();
    });
  });

  describe('getMetrics', () => {
    it('should return agent metrics', () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
      });

      const metrics = agent.getMetrics();

      expect(metrics.totalExecutions).toBe(0);
      expect(metrics.successfulExecutions).toBe(0);
      expect(metrics.failedExecutions).toBe(0);
    });

    it('should track execution metrics', async () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
      });

      await agent.execute('Test');

      const metrics = agent.getMetrics();

      expect(metrics.totalExecutions).toBeGreaterThanOrEqual(1);
    });
  });

  describe('middleware', () => {
    it('should add middleware', () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
      });

      const middleware = {
        name: 'test-middleware',
        priority: 100,
        async handle(context, next) {
          return next();
        },
      };

      agent.addMiddleware(middleware);
      agent.removeMiddleware('test-middleware');
    });
  });

  describe('observers', () => {
    it('should add and remove observers', () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
      });

      const observer = {
        name: 'test-observer',
        onStart(context) {},
      };

      agent.addObserver(observer);
      agent.removeObserver('test-observer');
    });
  });

  describe('observability', () => {
    it('should return logger', () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
      });

      const logger = agent.getLogger();

      expect(logger).toBeDefined();
    });

    it('should return metrics collector', () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
      });

      const metrics = agent.getMetricsCollector();

      expect(metrics).toBeDefined();
    });

    it('should return tracer', () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
      });

      const tracer = agent.getTracer();

      expect(tracer).toBeDefined();
    });

    it('should return monitor', () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
      });

      const monitor = agent.getMonitor();

      expect(monitor).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
      });

      await agent.cleanup();
    });

    it('should cleanup plugins', async () => {
      const cleanupFn = vi.fn();

      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: mockModel,
        plugins: [
          {
            name: 'test-plugin',
            async cleanup() {
              cleanupFn();
            },
          },
        ],
      });

      await agent.cleanup();

      expect(cleanupFn).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle model errors', async () => {
      const failingModel: Model = {
        name: 'failing-model',
        type: 'chat',
        async generate() {
          throw new Error('Model error');
        },
        async *stream() {},
        async embed() {
          return { embeddings: [] };
        },
      };

      const agent = createAgent({
        id: 'test',
        name: 'Test',
        model: failingModel,
      });

      const result = await agent.execute('Test');

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });
  });
});
