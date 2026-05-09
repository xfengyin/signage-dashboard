import { LogContext } from './logger';

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

export interface SpanAttributes {
  [key: string]: string | number | boolean | undefined;
}

export interface Span {
  context(): SpanContext;
  setAttribute(key: string, value: string | number | boolean): void;
  setAttributes(attributes: SpanAttributes): void;
  addEvent(name: string, attributes?: SpanAttributes): void;
  setStatus(code: 'OK' | 'ERROR', message?: string): void;
  end(): void;
  recordException(error: Error): void;
}

export interface TracerConfig {
  serviceName: string;
  serviceVersion?: string;
  enabled?: boolean;
  exportInterval?: number;
}

export interface TraceExporter {
  export(spans: SpanContext[]): Promise<void>;
}

export interface ToolCallTrace {
  toolName: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'started' | 'completed' | 'failed';
  attributes: SpanAttributes;
}

export class SpanImpl implements Span {
  private _context: SpanContext;
  private _attributes: SpanAttributes = {};
  private _events: Array<{ name: string; timestamp: number; attributes?: SpanAttributes }> = [];
  private _status: { code: 'OK' | 'ERROR'; message?: string } = { code: 'OK' };
  private _isRecording = true;
  private _endTime?: number;

  constructor(
    private tracer: TracerImpl,
    traceId: string,
    spanId: string,
    parentSpanId?: string
  ) {
    this._context = {
      traceId,
      spanId,
      parentSpanId,
      startTime: Date.now(),
    };
  }

  context(): SpanContext {
    return { ...this._context, endTime: this._endTime };
  }

  setAttribute(key: string, value: string | number | boolean): void {
    if (this._isRecording) {
      this._attributes[key] = value;
    }
  }

  setAttributes(attributes: SpanAttributes): void {
    if (this._isRecording) {
      Object.assign(this._attributes, attributes);
    }
  }

  addEvent(name: string, attributes?: SpanAttributes): void {
    if (this._isRecording) {
      this._events.push({
        name,
        timestamp: Date.now(),
        attributes,
      });
    }
  }

  setStatus(code: 'OK' | 'ERROR', message?: string): void {
    if (this._isRecording) {
      this._status = { code, message };
      if (code === 'ERROR') {
        this._attributes['otel.status_code'] = 'ERROR';
        if (message) {
          this._attributes['otel.status_description'] = message;
        }
      }
    }
  }

  end(): void {
    if (!this._isRecording) return;
    
    this._endTime = Date.now();
    this._context.endTime = this._endTime;
    this._context.duration = this._endTime - this._context.startTime;
    this._isRecording = false;
    
    this.tracer.recordSpan(this);
  }

  recordException(error: Error): void {
    if (this._isRecording) {
      this.setStatus('ERROR', error.message);
      this.setAttribute('error', true);
      this.setAttribute('error.message', error.message);
      this.setAttribute('error.type', error.name);
      this.addEvent('exception', {
        'exception.message': error.message,
        'exception.type': error.name,
        'exception.stacktrace': error.stack || '',
      });
    }
  }

  getAttributes(): SpanAttributes {
    return { ...this._attributes };
  }

  getEvents(): Array<{ name: string; timestamp: number; attributes?: SpanAttributes }> {
    return [...this._events];
  }

  getStatus(): { code: 'OK' | 'ERROR'; message?: string } {
    return { ...this._status };
  }
}

export class TracerImpl {
  private spans: Map<string, SpanImpl> = new Map();
  private completedSpans: SpanContext[] = [];
  private toolCallTraces: Map<string, ToolCallTrace> = new Map();
  private config: Required<TracerConfig>;

  constructor(config: TracerConfig) {
    this.config = {
      serviceVersion: '1.0.0',
      enabled: true,
      exportInterval: 5000,
      ...config,
    };
  }

  startSpan(name: string, parentContext?: SpanContext, attributes?: SpanAttributes): Span {
    const spanId = this.generateSpanId();
    const parentSpanId = parentContext?.spanId;

    const span = new SpanImpl(this, parentContext?.traceId || this.generateTraceId(), spanId, parentSpanId);

    if (attributes) {
      span.setAttributes(attributes);
    }

    span.setAttribute('span.name', name);
    span.setAttribute('service.name', this.config.serviceName);
    span.setAttribute('service.version', this.config.serviceVersion);

    this.spans.set(spanId, span);

    return span;
  }

  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  private generateSpanId(): string {
    return `span-${Math.random().toString(36).substring(2, 11)}`;
  }

  recordSpan(span: SpanImpl): void {
    if (!this.config.enabled) return;
    
    this.completedSpans.push(span.context());
    this.spans.delete(span.context().spanId);
  }

  startToolTrace(toolName: string, input: Record<string, unknown>, traceId?: string, parentSpanId?: string): string {
    const toolTraceId = `tool-${toolName}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    
    const trace: ToolCallTrace = {
      toolName,
      input,
      startTime: Date.now(),
      status: 'started',
      attributes: {
        'tool.name': toolName,
        'tool.trace_id': toolTraceId,
        'trace.id': traceId,
        'parent.span_id': parentSpanId,
      },
    };

    this.toolCallTraces.set(toolTraceId, trace);
    return toolTraceId;
  }

  completeToolTrace(toolTraceId: string, output?: unknown): void {
    const trace = this.toolCallTraces.get(toolTraceId);
    if (trace) {
      trace.endTime = Date.now();
      trace.duration = trace.endTime - trace.startTime;
      trace.output = output;
      trace.status = 'completed';
    }
  }

  failToolTrace(toolTraceId: string, error: Error): void {
    const trace = this.toolCallTraces.get(toolTraceId);
    if (trace) {
      trace.endTime = Date.now();
      trace.duration = trace.endTime - trace.startTime;
      trace.error = error.message;
      trace.status = 'failed';
      trace.attributes['error'] = true;
      trace.attributes['error.message'] = error.message;
    }
  }

  getToolTraces(): ToolCallTrace[] {
    return Array.from(this.toolCallTraces.values());
  }

  getActiveSpans(): number {
    return this.spans.size;
  }

  getCompletedSpans(): SpanContext[] {
    return [...this.completedSpans];
  }

  clear(): void {
    this.spans.clear();
    this.completedSpans = [];
    this.toolCallTraces.clear();
  }

  getTraceSummary(traceId: string): {
    totalSpans: number;
    totalDuration: number;
    spansByName: Map<string, number>;
    errors: number;
  } {
    const traceSpans = this.completedSpans.filter(s => s.traceId === traceId);
    
    const spansByName = new Map<string, number>();
    let totalDuration = 0;
    let errors = 0;

    for (const span of traceSpans) {
      const name = span.spanId;
      spansByName.set(name, (spansByName.get(name) || 0) + 1);
      totalDuration += span.duration || 0;
      if (span.duration !== undefined && span.duration > 1000) {
        errors++;
      }
    }

    return {
      totalSpans: traceSpans.length,
      totalDuration,
      spansByName,
      errors,
    };
  }

  injectContext(context: SpanContext, carrier: Record<string, string>): Record<string, string> {
    carrier['x-trace-id'] = context.traceId;
    carrier['x-span-id'] = context.spanId;
    if (context.parentSpanId) {
      carrier['x-parent-span-id'] = context.parentSpanId;
    }
    return carrier;
  }

  extractContext(carrier: Record<string, string>): SpanContext | undefined {
    const traceId = carrier['x-trace-id'];
    const spanId = carrier['x-span-id'];
    const parentSpanId = carrier['x-parent-span-id'];

    if (traceId && spanId) {
      return {
        traceId,
        spanId,
        parentSpanId,
        startTime: Date.now(),
      };
    }

    return undefined;
  }
}

export interface Tracer {
  startSpan(name: string, parentContext?: SpanContext, attributes?: SpanAttributes): Span;
  startToolTrace(toolName: string, input: Record<string, unknown>, traceId?: string, parentSpanId?: string): string;
  completeToolTrace(toolTraceId: string, output?: unknown): void;
  failToolTrace(toolTraceId: string, error: Error): void;
  getToolTraces(): ToolCallTrace[];
  getActiveSpans(): number;
  getCompletedSpans(): SpanContext[];
  injectContext(context: SpanContext, carrier: Record<string, string>): Record<string, string>;
  extractContext(carrier: Record<string, string>): SpanContext | undefined;
}

export function createTracer(config: TracerConfig): Tracer {
  return new TracerImpl(config);
}

export function createTraceContext(traceId?: string): LogContext {
  return {
    traceId: traceId || `trace-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
  };
}

export class ToolTracer {
  private tracer: TracerImpl;
  private activeTraces: Map<string, string> = new Map();

  constructor(tracer: TracerImpl) {
    this.tracer = tracer;
  }

  traceToolCall<T>(
    toolName: string,
    input: Record<string, unknown>,
    fn: () => T | Promise<T>,
    traceId?: string,
    parentSpanId?: string
  ): T | Promise<T> {
    const toolTraceId = this.tracer.startToolTrace(toolName, input, traceId, parentSpanId);
    const span = this.tracer.startSpan(`tool.${toolName}`, 
      traceId ? { traceId, spanId: '', startTime: 0 } : undefined,
      { 'tool.name': toolName, 'tool.input': JSON.stringify(input) }
    );

    const traceKey = toolTraceId;

    try {
      const result = fn();
      
      if (result instanceof Promise) {
        return (async () => {
          try {
            const resolved = await result;
            this.tracer.completeToolTrace(toolTraceId, resolved);
            span.setStatus('OK');
            span.end();
            return resolved;
          } catch (error) {
            const err = error as Error;
            this.tracer.failToolTrace(toolTraceId, err);
            span.recordException(err);
            span.end();
            throw error;
          }
        })() as T;
      } else {
        this.tracer.completeToolTrace(toolTraceId, result);
        span.setStatus('OK');
        span.end();
        return result;
      }
    } catch (error) {
      const err = error as Error;
      this.tracer.failToolTrace(toolTraceId, err);
      span.recordException(err);
      span.end();
      throw error;
    }
  }
}
