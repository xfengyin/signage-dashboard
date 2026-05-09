import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Interceptor,
  InterceptorRegistry,
  InterceptorContext,
  InterceptorResult,
  createInterceptor,
  RequestInterceptor,
  ResponseInterceptor,
  ErrorInterceptor,
} from '../../src/security/interceptor';

describe('Interceptor', () => {
  let interceptor: Interceptor;

  beforeEach(() => {
    interceptor = createInterceptor({
      name: 'test-interceptor',
      order: 1,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createInterceptor', () => {
    it('should create interceptor with name', () => {
      const i = createInterceptor({ name: 'myInterceptor' });

      expect(i.name).toBe('myInterceptor');
    });

    it('should create interceptor with order', () => {
      const i = createInterceptor({ name: 'test', order: 5 });

      expect(i.order).toBe(5);
    });

    it('should create interceptor with before hook', async () => {
      const beforeFn = vi.fn().mockReturnValue({ modified: true });
      const i = createInterceptor({
        name: 'before-test',
        before: beforeFn,
      });

      const context: InterceptorContext = {
        request: { url: '/test', method: 'GET', headers: {}, body: null },
        response: null,
        error: null,
      };

      await i.before!(context);

      expect(beforeFn).toHaveBeenCalledWith(context);
    });

    it('should create interceptor with after hook', async () => {
      const afterFn = vi.fn();
      const i = createInterceptor({
        name: 'after-test',
        after: afterFn,
      });

      const context: InterceptorContext = {
        request: { url: '/test', method: 'GET', headers: {}, body: null },
        response: { status: 200, data: {}, headers: {} },
        error: null,
      };

      await i.after!(context);

      expect(afterFn).toHaveBeenCalledWith(context);
    });

    it('should create interceptor with onError hook', async () => {
      const onErrorFn = vi.fn();
      const i = createInterceptor({
        name: 'error-test',
        onError: onErrorFn,
      });

      const error = new Error('Test error');
      const context: InterceptorContext = {
        request: { url: '/test', method: 'GET', headers: {}, body: null },
        response: null,
        error,
      };

      await i.onError!(error, context);

      expect(onErrorFn).toHaveBeenCalledWith(error, context);
    });
  });

  describe('interceptor lifecycle', () => {
    it('should execute before hook before operation', async () => {
      const beforeFn = vi.fn();
      const operationFn = vi.fn().mockResolvedValue('result');

      const i = createInterceptor({
        name: 'test',
        before: beforeFn,
      });

      await i.execute!(({} as any), operationFn);

      expect(beforeFn).toHaveBeenCalled();
      expect(operationFn).toHaveBeenCalled();
    });

    it('should skip operation when before returns false', async () => {
      const operationFn = vi.fn();

      const i = createInterceptor({
        name: 'test',
        before: () => false,
      });

      await i.execute!({} as any, operationFn);

      expect(operationFn).not.toHaveBeenCalled();
    });

    it('should execute after hook after operation', async () => {
      const afterFn = vi.fn();

      const i = createInterceptor({
        name: 'test',
        after: afterFn,
      });

      await i.execute!({} as any, async () => 'result');

      expect(afterFn).toHaveBeenCalled();
    });

    it('should execute onError hook when operation fails', async () => {
      const onErrorFn = vi.fn();

      const i = createInterceptor({
        name: 'test',
        onError: onErrorFn,
      });

      await i.execute!({} as any, async () => {
        throw new Error('operation failed');
      });

      expect(onErrorFn).toHaveBeenCalled();
    });
  });

  describe('interceptor order', () => {
    it('should sort interceptors by order', () => {
      const interceptors = [
        createInterceptor({ name: 'third', order: 3 }),
        createInterceptor({ name: 'first', order: 1 }),
        createInterceptor({ name: 'second', order: 2 }),
      ];

      interceptors.sort((a, b) => a.order - b.order);

      expect(interceptors[0].name).toBe('first');
      expect(interceptors[1].name).toBe('second');
      expect(interceptors[2].name).toBe('third');
    });
  });
});

describe('InterceptorRegistry', () => {
  let registry: InterceptorRegistry;

  beforeEach(() => {
    registry = new InterceptorRegistry();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register interceptor', () => {
      const interceptor = createInterceptor({ name: 'test' });
      registry.register(interceptor);

      expect(registry.getAll()).toContain(interceptor);
    });

    it('should not register duplicate interceptor', () => {
      const interceptor = createInterceptor({ name: 'test' });
      registry.register(interceptor);
      registry.register(interceptor);

      expect(registry.getAll().filter(i => i.name === 'test')).toHaveLength(1);
    });
  });

  describe('unregister', () => {
    it('should unregister interceptor by name', () => {
      const interceptor = createInterceptor({ name: 'test' });
      registry.register(interceptor);
      registry.unregister('test');

      expect(registry.getAll()).not.toContain(interceptor);
    });

    it('should return false for non-existent interceptor', () => {
      const result = registry.unregister('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('get', () => {
    it('should get interceptor by name', () => {
      const interceptor = createInterceptor({ name: 'test' });
      registry.register(interceptor);

      const result = registry.get('test');

      expect(result).toBe(interceptor);
    });

    it('should return undefined for non-existent interceptor', () => {
      const result = registry.get('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for registered interceptor', () => {
      const interceptor = createInterceptor({ name: 'test' });
      registry.register(interceptor);

      expect(registry.has('test')).toBe(true);
    });

    it('should return false for unregistered interceptor', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all interceptors', () => {
      registry.register(createInterceptor({ name: 'test1' }));
      registry.register(createInterceptor({ name: 'test2' }));
      registry.clear();

      expect(registry.getAll()).toHaveLength(0);
    });
  });

  describe('execute', () => {
    it('should execute all interceptors', async () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();

      registry.register(createInterceptor({ name: 'test1', before: fn1 }));
      registry.register(createInterceptor({ name: 'test2', before: fn2 }));

      await registry.execute({} as any, async () => 'result');

      expect(fn1).toHaveBeenCalled();
      expect(fn2).toHaveBeenCalled();
    });

    it('should execute in order', async () => {
      const order: number[] = [];

      registry.register(createInterceptor({
        name: 'first',
        order: 1,
        before: () => { order.push(1); },
      }));
      registry.register(createInterceptor({
        name: 'second',
        order: 2,
        before: () => { order.push(2); },
      }));

      await registry.execute({} as any, async () => 'result');

      expect(order).toEqual([1, 2]);
    });

    it('should short-circuit when interceptor returns false', async () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();

      registry.register(createInterceptor({
        name: 'block',
        order: 1,
        before: () => false,
      }));
      registry.register(createInterceptor({
        name: 'should-not-run',
        order: 2,
        before: fn2,
      }));

      await registry.execute({} as any, fn1);

      expect(fn1).not.toHaveBeenCalled();
      expect(fn2).not.toHaveBeenCalled();
    });

    it('should handle errors in interceptors', async () => {
      const onErrorFn = vi.fn();

      registry.register(createInterceptor({
        name: 'error-prone',
        before: () => { throw new Error('interceptor error'); },
        onError: onErrorFn,
      }));

      await expect(
        registry.execute({} as any, async () => 'result')
      ).rejects.toThrow('interceptor error');
    });

    it('should execute after hooks on success', async () => {
      const afterFn = vi.fn();

      registry.register(createInterceptor({
        name: 'test',
        after: afterFn,
      }));

      await registry.execute({} as any, async () => 'result');

      expect(afterFn).toHaveBeenCalled();
    });

    it('should execute onError hooks on failure', async () => {
      const onErrorFn = vi.fn();

      registry.register(createInterceptor({
        name: 'test',
        onError: onErrorFn,
      }));

      await expect(
        registry.execute({} as any, async () => { throw new Error('failed'); })
      ).rejects.toThrow('failed');

      expect(onErrorFn).toHaveBeenCalled();
    });
  });

  describe('getAll', () => {
    it('should return all registered interceptors', () => {
      registry.register(createInterceptor({ name: 'test1' }));
      registry.register(createInterceptor({ name: 'test2' }));

      const all = registry.getAll();

      expect(all).toHaveLength(2);
    });

    it('should return empty array when no interceptors registered', () => {
      const all = registry.getAll();

      expect(all).toHaveLength(0);
    });
  });
});

describe('RequestInterceptor', () => {
  it('should create request interceptor', () => {
    const interceptor = RequestInterceptor('validate', async (ctx) => {
      return ctx;
    });

    expect(interceptor.name).toBe('validate');
    expect(interceptor.before).toBeDefined();
  });
});

describe('ResponseInterceptor', () => {
  it('should create response interceptor', () => {
    const interceptor = ResponseInterceptor('transform', async (ctx) => {
      return ctx;
    });

    expect(interceptor.name).toBe('transform');
    expect(interceptor.after).toBeDefined();
  });
});

describe('ErrorInterceptor', () => {
  it('should create error interceptor', () => {
    const handler = vi.fn();
    const interceptor = ErrorInterceptor('handle', handler);

    expect(interceptor.name).toBe('handle');
    expect(interceptor.onError).toBe(handler);
  });
});

describe('InterceptorContext', () => {
  it('should have correct structure', () => {
    const context: InterceptorContext = {
      request: {
        url: '/api/test',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { data: 'test' },
      },
      response: {
        status: 200,
        data: { result: 'success' },
        headers: {},
      },
      error: null,
    };

    expect(context.request.url).toBe('/api/test');
    expect(context.request.method).toBe('POST');
    expect(context.response?.status).toBe(200);
    expect(context.error).toBeNull();
  });

  it('should include error when present', () => {
    const error = new Error('test error');
    const context: InterceptorContext = {
      request: { url: '/test', method: 'GET', headers: {}, body: null },
      response: null,
      error,
    };

    expect(context.error).toBe(error);
  });
});

describe('InterceptorResult', () => {
  it('should allow request modification', async () => {
    const modifiedRequest = {
      url: '/modified',
      method: 'GET',
      headers: {},
      body: null,
    };

    const result: InterceptorResult = {
      modified: true,
      request: modifiedRequest,
    };

    expect(result.modified).toBe(true);
    expect(result.request).toBe(modifiedRequest);
  });

  it('should indicate blocking', () => {
    const result: InterceptorResult = {
      modified: false,
      blocked: true,
      blockReason: 'Not authorized',
    };

    expect(result.blocked).toBe(true);
    expect(result.blockReason).toBe('Not authorized');
  });
});
