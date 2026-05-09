import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TracerImpl,
  SpanImpl,
  ToolTracer,
  createTracer,
  createTraceContext,
} from '../../src/observability/tracer';

describe('TracerImpl', () => {
  let tracer: TracerImpl;

  beforeEach(() => {
    tracer = createTracer({ serviceName: 'test-service' });
  });

  afterEach(() => {
    tracer.clear();
  });

  describe('startSpan', () => {
    it('should create a span', () => {
      const span = tracer.startSpan('test-span');

      expect(span).toBeInstanceOf(SpanImpl);
      expect(tracer.getActiveSpans()).toBe(1);
    });

    it('should create span with attributes', () => {
      const span = tracer.startSpan('test-span', undefined, { 'user.id': '123' });

      expect(span.getAttributes()['user.id']).toBe('123');
    });

    it('should create child span from parent', () => {
      const parentSpan = tracer.startSpan('parent');
      const parentContext = parentSpan.context();

      const childSpan = tracer.startSpan('child', parentContext);

      expect(childSpan.context().parentSpanId).toBe(parentContext.spanId);
    });

    it('should set service info as attributes', () => {
      const span = tracer.startSpan('test-span');

      expect(span.getAttributes()['service.name']).toBe('test-service');
    });
  });

  describe('SpanImpl', () => {
    let span: ReturnType<typeof tracer.startSpan>;

    beforeEach(() => {
      span = tracer.startSpan('test-span');
    });

    it('should set single attribute', () => {
      span.setAttribute('key', 'value');

      expect(span.getAttributes()['key']).toBe('value');
    });

    it('should set multiple attributes', () => {
      span.setAttributes({ key1: 'value1', key2: 123 });

      expect(span.getAttributes()['key1']).toBe('value1');
      expect(span.getAttributes()['key2']).toBe(123);
    });

    it('should add event', () => {
      span.addEvent('test-event', { 'event.attr': 'value' });

      expect(span.getEvents()).toHaveLength(1);
      expect(span.getEvents()[0].name).toBe('test-event');
    });

    it('should set OK status', () => {
      span.setStatus('OK');

      expect(span.getStatus().code).toBe('OK');
    });

    it('should set ERROR status', () => {
      span.setStatus('ERROR', 'Something went wrong');

      expect(span.getStatus().code).toBe('ERROR');
      expect(span.getStatus().message).toBe('Something went wrong');
    });

    it('should record exception', () => {
      const error = new Error('Test error');
      span.recordException(error);

      expect(span.getStatus().code).toBe('ERROR');
      expect(span.getAttributes()['error']).toBe(true);
    });

    it('should end span and record to tracer', () => {
      span.end();

      expect(tracer.getActiveSpans()).toBe(0);
      expect(tracer.getCompletedSpans()).toHaveLength(1);
    });

    it('should calculate duration on end', () => {
      span.end();

      const context = span.context();
      expect(context.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ToolCallTrace', () => {
    it('should start tool trace', () => {
      const traceId = tracer.startToolTrace('calculator', { a: 1, b: 2 });

      expect(traceId).toBeTruthy();
      expect(tracer.getToolTraces()).toHaveLength(1);
    });

    it('should complete tool trace with output', () => {
      const traceId = tracer.startToolTrace('calculator', { a: 1, b: 2 });
      tracer.completeToolTrace(traceId, { result: 3 });

      const traces = tracer.getToolTraces();
      expect(traces[0].status).toBe('completed');
      expect(traces[0].output).toEqual({ result: 3 });
    });

    it('should fail tool trace with error', () => {
      const traceId = tracer.startToolTrace('calculator', { a: 1, b: 2 });
      tracer.failToolTrace(traceId, new Error('Calculation failed'));

      const traces = tracer.getToolTraces();
      expect(traces[0].status).toBe('failed');
      expect(traces[0].error).toBe('Calculation failed');
    });

    it('should track duration', () => {
      const traceId = tracer.startToolTrace('calculator', {});
      tracer.completeToolTrace(traceId, {});

      const traces = tracer.getToolTraces();
      expect(traces[0].duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('context injection/extraction', () => {
    it('should inject context to carrier', () => {
      const span = tracer.startSpan('test');
      const carrier: Record<string, string> = {};

      tracer.injectContext(span.context(), carrier);

      expect(carrier['x-trace-id']).toBeTruthy();
      expect(carrier['x-span-id']).toBeTruthy();
    });

    it('should extract context from carrier', () => {
      const carrier = {
        'x-trace-id': 'trace-123',
        'x-span-id': 'span-456',
        'x-parent-span-id': 'span-789',
      };

      const context = tracer.extractContext(carrier);

      expect(context?.traceId).toBe('trace-123');
      expect(context?.spanId).toBe('span-456');
      expect(context?.parentSpanId).toBe('span-789');
    });

    it('should return undefined for invalid carrier', () => {
      const context = tracer.extractContext({});

      expect(context).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear all spans and traces', () => {
      tracer.startSpan('span1');
      tracer.startSpan('span2');
      tracer.startToolTrace('tool1', {});

      tracer.clear();

      expect(tracer.getActiveSpans()).toBe(0);
      expect(tracer.getCompletedSpans()).toHaveLength(0);
      expect(tracer.getToolTraces()).toHaveLength(0);
    });
  });

  describe('getTraceSummary', () => {
    it('should return trace summary', () => {
      const span1 = tracer.startSpan('span1');
      const context = span1.context();
      span1.end();

      const summary = tracer.getTraceSummary(context.traceId);

      expect(summary.totalSpans).toBe(1);
      expect(summary.spansByName.size).toBe(1);
    });
  });
});

describe('ToolTracer', () => {
  let tracer: TracerImpl;
  let toolTracer: ToolTracer;

  beforeEach(() => {
    tracer = createTracer({ serviceName: 'test-service' });
    toolTracer = new ToolTracer(tracer);
  });

  afterEach(() => {
    tracer.clear();
  });

  describe('traceToolCall', () => {
    it('should trace successful synchronous call', () => {
      const result = toolTracer.traceToolCall(
        'add',
        { a: 1, b: 2 },
        () => 3
      );

      expect(result).toBe(3);
      expect(tracer.getToolTraces()).toHaveLength(1);
      expect(tracer.getToolTraces()[0].status).toBe('completed');
    });

    it('should trace successful async call', async () => {
      const result = await toolTracer.traceToolCall(
        'add',
        { a: 1, b: 2 },
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 3;
        }
      );

      expect(result).toBe(3);
      expect(tracer.getToolTraces()[0].status).toBe('completed');
    });

    it('should trace failed call', async () => {
      await expect(
        toolTracer.traceToolCall(
          'add',
          { a: 1, b: 2 },
          async () => {
            throw new Error('Addition failed');
          }
        )
      ).rejects.toThrow('Addition failed');

      expect(tracer.getToolTraces()[0].status).toBe('failed');
      expect(tracer.getToolTraces()[0].error).toBe('Addition failed');
    });

    it('should trace with parent context', () => {
      const parentSpan = tracer.startSpan('parent');
      const parentContext = parentSpan.context();

      toolTracer.traceToolCall(
        'add',
        { a: 1, b: 2 },
        () => 3,
        parentContext.traceId,
        parentContext.spanId
      );

      const trace = tracer.getToolTraces()[0];
      expect(trace.attributes['trace.id']).toBe(parentContext.traceId);
      expect(trace.attributes['parent.span_id']).toBe(parentContext.spanId);
    });
  });
});

describe('createTracer', () => {
  it('should create tracer with config', () => {
    const tracer = createTracer({
      serviceName: 'my-service',
      serviceVersion: '2.0.0',
    });

    expect(tracer).toBeInstanceOf(TracerImpl);
  });

  it('should create tracer with defaults', () => {
    const tracer = createTracer({ serviceName: 'test' });

    expect(tracer).toBeInstanceOf(TracerImpl);
  });
});

describe('createTraceContext', () => {
  it('should create trace context with generated ID', () => {
    const context = createTraceContext();

    expect(context.traceId).toBeTruthy();
    expect(context.traceId).toMatch(/^trace-/);
  });

  it('should create trace context with provided ID', () => {
    const context = createTraceContext('custom-trace-id');

    expect(context.traceId).toBe('custom-trace-id');
  });
});
