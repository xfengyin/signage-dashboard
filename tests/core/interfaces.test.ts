import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Tool,
  Model,
  Agent,
  Skill,
  ExecutionContext,
  ExecutionResult,
  ExecutionPlan,
  Middleware,
  Observer,
  CacheStrategy,
  EventBus,
  Pipeline,
  Metrics,
  HealthCheck,
  Validator,
  Serializer,
  Transformer,
} from '../../src/core/interfaces';

describe('Tool Interface', () => {
  describe('structure', () => {
    it('should have required properties', () => {
      const tool: Tool = {
        name: 'calculator',
        description: 'Performs calculations',
        async validate(params) {
          return typeof params === 'object';
        },
        async execute(params) {
          return { result: params };
        },
      };

      expect(tool.name).toBe('calculator');
      expect(tool.description).toBe('Performs calculations');
    });

    it('should support optional metadata', () => {
      const tool: Tool = {
        name: 'test',
        description: 'Test tool',
        metadata: { version: '1.0.0' },
        async validate() { return true; },
        async execute() { return null; },
      };

      expect(tool.metadata?.version).toBe('1.0.0');
    });
  });

  describe('validation', () => {
    it('should validate parameters', async () => {
      const tool: Tool = {
        name: 'test',
        description: 'Test',
        async validate(params) {
          return typeof params === 'object' && params !== null;
        },
        async execute() { return null; },
      };

      const valid = await tool.validate({ key: 'value' });
      const invalid = await tool.validate('string');

      expect(valid).toBe(true);
      expect(invalid).toBe(false);
    });
  });

  describe('execution', () => {
    it('should execute with context', async () => {
      let receivedContext: ExecutionContext | undefined;

      const tool: Tool = {
        name: 'test',
        description: 'Test',
        async validate() { return true; },
        async execute(params, context) {
          receivedContext = context;
          return params;
        },
      };

      const mockContext = {
        requestId: 'test-123',
        status: 'running' as const,
        phase: 'execution' as const,
        messages: [],
        variables: new Map(),
        toolCalls: [],
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        currentIteration: 0,
        metadata: {},
      };

      await tool.execute({ data: 'test' }, mockContext);

      expect(receivedContext).toBeDefined();
    });
  });
});

describe('Model Interface', () => {
  describe('generate', () => {
    it('should generate non-streaming response', async () => {
      const model: Model = {
        name: 'test-model',
        type: 'chat',
        async generate(messages, context) {
          return {
            content: 'Generated response',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            finishReason: 'stop',
          };
        },
        stream: async function* () {},
        async embed(input) {
          return { embeddings: [[0.1, 0.2]], model: 'test' };
        },
      };

      const response = await model.generate([{ role: 'user', content: 'Hello' }]);

      expect(response.content).toBe('Generated response');
      expect(response.usage?.totalTokens).toBe(30);
    });
  });

  describe('stream', () => {
    it('should return async generator for streaming', async () => {
      const model: Model = {
        name: 'test-model',
        type: 'chat',
        async generate() { return { content: '' }; },
        async *stream(messages) {
          yield { delta: 'Hello', done: false };
          yield { delta: ' World', done: true, usage: { inputTokens: 5, outputTokens: 6, totalTokens: 11 } };
        },
        async embed() { return { embeddings: [] }; },
      };

      const stream = model.stream([{ role: 'user', content: 'Hi' }]);
      const chunks = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(2);
      expect(chunks[0].delta).toBe('Hello');
    });
  });

  describe('embed', () => {
    it('should generate embeddings', async () => {
      const model: Model = {
        name: 'test-model',
        type: 'embedding',
        async generate() { return { content: '' }; },
        async *stream() {},
        async embed(input) {
          return {
            embeddings: [input === 'test' ? [0.1, 0.2] : [0.3, 0.4]],
            usage: { inputTokens: 1, outputTokens: 0, totalTokens: 1 },
          };
        },
      };

      const result = await model.embed('test');

      expect(result.embeddings[0]).toEqual([0.1, 0.2]);
    });
  });
});

describe('Agent Interface', () => {
  it('should have required properties', () => {
    const agent: Agent = {
      id: 'agent-1',
      name: 'Test Agent',
      description: 'A test agent',
      version: '1.0.0',
      model: {
        name: 'test-model',
        type: 'chat',
        async generate() { return { content: '' }; },
        async *stream() {},
        async embed() { return { embeddings: [] }; },
      },
      config: {
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
      },
      tools: new Map(),
      skills: new Map(),
      registerTool(tool) {
        this.tools.set(tool.name, tool);
      },
      removeTool(name) {
        return this.tools.delete(name);
      },
      registerSkill(skill) {
        this.skills.set(skill.id, skill);
      },
      removeSkill(id) {
        return this.skills.delete(id);
      },
      async execute() {
        return {
          requestId: 'test',
          status: 'completed' as const,
          output: { role: 'assistant' as const, content: 'result' },
          messages: [],
          toolCalls: [],
          toolResults: [],
          tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          duration: 100,
          phases: [],
          cancelled: false,
          metadata: {},
        };
      },
    };

    expect(agent.id).toBe('agent-1');
    expect(agent.name).toBe('Test Agent');
    expect(agent.tools.size).toBe(0);
    expect(agent.skills.size).toBe(0);
  });

  describe('execute', () => {
    it('should accept string input', async () => {
      const agent: Agent = {
        id: 'test',
        name: 'Test',
        description: '',
        version: '1.0.0',
        model: {
          name: 'model',
          type: 'chat',
          async generate() { return { content: 'response' }; },
          async *stream() {},
          async embed() { return { embeddings: [] }; },
        },
        config: {
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
        },
        tools: new Map(),
        skills: new Map(),
        registerTool() {},
        removeTool() { return true; },
        registerSkill() {},
        removeSkill() { return true; },
        async execute(input) {
          return {
            requestId: 'test',
            status: 'completed' as const,
            output: { role: 'assistant' as const, content: 'result' },
            messages: typeof input === 'string' ? [{ role: 'user', content: input }] : input,
            toolCalls: [],
            toolResults: [],
            tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            duration: 100,
            phases: [],
            cancelled: false,
            metadata: {},
          };
        },
      };

      const result = await agent.execute('Hello');

      expect(result.messages[0].content).toBe('Hello');
    });

    it('should accept Message array input', async () => {
      const agent: Agent = {
        id: 'test',
        name: 'Test',
        description: '',
        version: '1.0.0',
        model: {
          name: 'model',
          type: 'chat',
          async generate() { return { content: 'response' }; },
          async *stream() {},
          async embed() { return { embeddings: [] }; },
        },
        config: {
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
        },
        tools: new Map(),
        skills: new Map(),
        registerTool() {},
        removeTool() { return true; },
        registerSkill() {},
        removeSkill() { return true; },
        async execute(input) {
          return {
            requestId: 'test',
            status: 'completed' as const,
            output: { role: 'assistant' as const, content: 'result' },
            messages: input as any,
            toolCalls: [],
            toolResults: [],
            tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            duration: 100,
            phases: [],
            cancelled: false,
            metadata: {},
          };
        },
      };

      const messages = [
        { role: 'system' as const, content: 'You are helpful' },
        { role: 'user' as const, content: 'Hello' },
      ];

      const result = await agent.execute(messages);

      expect(result.messages).toEqual(messages);
    });
  });
});

describe('Middleware Interface', () => {
  it('should have required properties', () => {
    const middleware: Middleware = {
      name: 'logging-middleware',
      priority: 100,
      async handle(context, next) {
        console.log('Before execution');
        const result = await next();
        console.log('After execution');
        return result;
      },
    };

    expect(middleware.name).toBe('logging-middleware');
    expect(middleware.priority).toBe(100);
  });
});

describe('Observer Interface', () => {
  it('should have optional lifecycle hooks', () => {
    const observer: Observer = {
      name: 'test-observer',
      onStart(context) {
        expect(context.requestId).toBeDefined();
      },
    };

    expect(observer.name).toBe('test-observer');
    expect(observer.onStart).toBeDefined();
  });
});

describe('CacheStrategy Interface', () => {
  it('should define cache operations', async () => {
    const cache: CacheStrategy = {
      async get(key) {
        return undefined;
      },
      async set(key, value) {},
      async delete(key) {
        return true;
      },
      async clear() {},
      async has(key) {
        return false;
      },
    };

    expect(typeof cache.get).toBe('function');
    expect(typeof cache.set).toBe('function');
    expect(typeof cache.delete).toBe('function');
    expect(typeof cache.clear).toBe('function');
    expect(typeof cache.has).toBe('function');
  });
});

describe('Validator Interface', () => {
  it('should validate and return errors', () => {
    const validator: Validator = {
      validate(input) {
        return typeof input === 'string';
      },
      errors() {
        return ['Error 1', 'Error 2'];
      },
    };

    expect(validator.validate('test')).toBe(true);
    expect(validator.validate(123)).toBe(false);
    expect(validator.errors()).toHaveLength(2);
  });
});

describe('Serializer Interface', () => {
  it('should serialize and deserialize', async () => {
    const serializer: Serializer = {
      async serialize(value) {
        return JSON.stringify(value);
      },
      async deserialize(data) {
        return JSON.parse(data);
      },
    };

    const serialized = await serializer.serialize({ key: 'value' });
    const deserialized = await serializer.deserialize(serialized);

    expect(serialized).toBe('{"key":"value"}');
    expect(deserialized).toBeEqual({ key: 'value' });
  });
});

describe('Transformer Interface', () => {
  it('should transform values', async () => {
    const transformer: Transformer = {
      transform(input) {
        return String(input).toUpperCase();
      },
    };

    const result = await transformer.transform('hello');

    expect(result).toBe('HELLO');
  });
});

describe('HealthCheck Interface', () => {
  it('should perform health check', async () => {
    const healthCheck: HealthCheck = {
      name: 'database-health',
      async check() {
        return { healthy: true, message: 'Database is healthy' };
      },
    };

    const result = await healthCheck.check();

    expect(result.healthy).toBe(true);
    expect(result.message).toBe('Database is healthy');
  });
});
