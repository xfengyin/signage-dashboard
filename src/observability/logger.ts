export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogContext {
  traceId?: string;
  spanId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  metadata?: Record<string, unknown>;
}

export interface LogTransport {
  log(entry: LogEntry): void;
  flush(): Promise<void>;
}

export interface LoggerConfig {
  level: LogLevel;
  transports: LogTransport[];
  enableContext?: boolean;
  sensitiveFields?: string[];
}

export class ConsoleTransport implements LogTransport {
  private buffer: LogEntry[] = [];
  private flushInterval: number;
  private timer?: NodeJS.Timeout;

  constructor(flushInterval = 1000) {
    this.flushInterval = flushInterval;
    this.startFlushTimer();
  }

  private startFlushTimer(): void {
    this.timer = setInterval(() => this.flush(), this.flushInterval);
  }

  log(entry: LogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length >= 100) {
      this.flushSync();
    }
  }

  async flush(): Promise<void> {
    this.flushSync();
  }

  private flushSync(): void {
    for (const entry of this.buffer) {
      const output = JSON.stringify(entry);
      switch (entry.level) {
        case LogLevel.ERROR:
        case LogLevel.WARN:
          console.error(output);
          break;
        default:
          console.log(output);
      }
    }
    this.buffer = [];
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}

export class FileTransport implements LogTransport {
  private buffer: LogEntry[] = [];
  private filePath: string;
  private maxBufferSize: number;

  constructor(filePath: string, maxBufferSize = 1000) {
    this.filePath = filePath;
    this.maxBufferSize = maxBufferSize;
  }

  log(entry: LogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length >= this.maxBufferSize) {
      this.flushSync();
    }
  }

  async flush(): Promise<void> {
    this.flushSync();
  }

  private async flushSync(): Promise<void> {
    if (this.buffer.length === 0) return;
    
    const content = this.buffer.map(e => JSON.stringify(e)).join('\n') + '\n';
    const fs = await import('fs');
    fs.appendFileSync(this.filePath, content, 'utf-8');
    this.buffer = [];
  }
}

export class RemoteTransport implements LogTransport {
  private buffer: LogEntry[] = [];
  private endpoint: string;
  private batchSize: number;
  private flushInterval: number;
  private timer?: NodeJS.Timeout;

  constructor(endpoint: string, batchSize = 50, flushInterval = 5000) {
    this.endpoint = endpoint;
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.startFlushTimer();
  }

  private startFlushTimer(): void {
    this.timer = setInterval(() => this.flush(), this.flushInterval);
  }

  async log(entry: LogEntry): Promise<void> {
    this.buffer.push(entry);
    if (this.buffer.length >= this.batchSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.slice();
    this.buffer = [];

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: batch }),
      });
      if (!response.ok) {
        this.buffer.unshift(...batch);
      }
    } catch (error) {
      this.buffer.unshift(...batch);
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}

export class Logger {
  private config: LoggerConfig;
  private levelPriority: Map<LogLevel, number>;

  constructor(config: LoggerConfig) {
    this.config = config;
    this.levelPriority = new Map([
      [LogLevel.DEBUG, 0],
      [LogLevel.INFO, 1],
      [LogLevel.WARN, 2],
      [LogLevel.ERROR, 3],
    ]);
  }

  private shouldLog(level: LogLevel): boolean {
    const configLevel = this.levelPriority.get(this.config.level) ?? 0;
    const messageLevel = this.levelPriority.get(level) ?? 0;
    return messageLevel >= configLevel;
  }

  private sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...data };
    const sensitiveFields = this.config.sensitiveFields || [
      'password',
      'token',
      'secret',
      'apiKey',
      'api_key',
      'authorization',
    ];

    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeData(sanitized[key] as Record<string, unknown>);
      }
    }

    return sanitized;
  }

  private createEntry(level: LogLevel, message: string, context: LogContext, metadata?: Record<string, unknown>): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.config.enableContext !== false ? this.sanitizeData(context) : {},
      metadata: metadata ? this.sanitizeData(metadata) : undefined,
    };
    return entry;
  }

  private log(level: LogLevel, message: string, context: LogContext = {}, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createEntry(level, message, context, metadata);
    for (const transport of this.config.transports) {
      transport.log(entry);
    }
  }

  debug(message: string, context?: LogContext, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context || {}, metadata);
  }

  info(message: string, context?: LogContext, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context || {}, metadata);
  }

  warn(message: string, context?: LogContext, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context || {}, metadata);
  }

  error(message: string, context?: LogContext, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context || {}, metadata);
  }

  createChild(additionalContext: LogContext): Logger {
    return new Logger({
      ...this.config,
    });
  }

  async flush(): Promise<void> {
    await Promise.all(this.config.transports.map(t => t.flush()));
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }
}

export function createLogger(config: Partial<LoggerConfig> & { transports: LogTransport[] }): Logger {
  return new Logger({
    level: LogLevel.INFO,
    enableContext: true,
    sensitiveFields: [
      'password',
      'token',
      'secret',
      'apiKey',
      'api_key',
      'authorization',
    ],
    ...config,
  });
}

export function generateTraceId(): string {
  return `trace-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export function generateSpanId(): string {
  return `span-${Math.random().toString(36).substring(2, 11)}`;
}
