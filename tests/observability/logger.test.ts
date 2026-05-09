import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Logger,
  ConsoleTransport,
  FileTransport,
  RemoteTransport,
  LogLevel,
  createLogger,
  generateTraceId,
  generateSpanId,
} from '../../src/observability/logger';

describe('Logger', () => {
  let logger: Logger;
  let mockTransport: { log: ReturnType<typeof vi.fn>; flush: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockTransport = {
      log: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
    };
    logger = createLogger({
      level: LogLevel.INFO,
      transports: [mockTransport as any],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create logger with config', () => {
      const l = new Logger({
        level: LogLevel.DEBUG,
        transports: [mockTransport as any],
      });

      expect(l).toBeInstanceOf(Logger);
    });

    it('should have correct level priority', () => {
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(mockTransport.log).toHaveBeenCalledTimes(4);
    });
  });

  describe('log levels', () => {
    it('should log debug messages', () => {
      const l = createLogger({
        level: LogLevel.DEBUG,
        transports: [mockTransport as any],
      });

      l.debug('debug message', { key: 'value' });

      expect(mockTransport.log).toHaveBeenCalled();
    });

    it('should log info messages', () => {
      logger.info('info message');

      expect(mockTransport.log).toHaveBeenCalled();
    });

    it('should log warn messages', () => {
      logger.warn('warn message');

      expect(mockTransport.log).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      logger.error('error message');

      expect(mockTransport.log).toHaveBeenCalled();
    });

    it('should not log messages below threshold', () => {
      const l = createLogger({
        level: LogLevel.ERROR,
        transports: [mockTransport as any],
      });

      l.debug('debug message');
      l.info('info message');
      l.warn('warn message');

      expect(mockTransport.log).not.toHaveBeenCalled();
    });
  });

  describe('sensitive data sanitization', () => {
    it('should sanitize sensitive fields', () => {
      logger.info('User login', { password: 'secret123', username: 'test' });

      const logEntry = mockTransport.log.mock.calls[0][0];
      expect(logEntry.context.password).toBe('***REDACTED***');
      expect(logEntry.context.username).toBe('test');
    });

    it('should sanitize nested sensitive fields', () => {
      logger.info('User data', {
        user: {
          password: 'secret',
          name: 'John',
        },
      });

      const logEntry = mockTransport.log.mock.calls[0][0];
      expect(logEntry.context.user.password).toBe('***REDACTED***');
      expect(logEntry.context.user.name).toBe('John');
    });
  });

  describe('flush', () => {
    it('should flush all transports', async () => {
      await logger.flush();

      expect(mockTransport.flush).toHaveBeenCalled();
    });
  });

  describe('setLevel', () => {
    it('should change log level', () => {
      logger.setLevel(LogLevel.ERROR);

      logger.info('info message');

      expect(mockTransport.log).not.toHaveBeenCalled();
    });
  });

  describe('createChild', () => {
    it('should create child logger', () => {
      const child = logger.createChild({ traceId: 'trace123' });

      expect(child).toBeInstanceOf(Logger);
    });
  });
});

describe('ConsoleTransport', () => {
  let transport: ConsoleTransport;

  beforeEach(() => {
    vi.useFakeTimers();
    transport = new ConsoleTransport(1000);
  });

  afterEach(() => {
    transport.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should log entries', () => {
    transport.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message: 'test message',
      context: {},
    });

    expect(transport).toBeInstanceOf(ConsoleTransport);
  });

  it('should flush entries', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    transport.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message: 'test',
      context: {},
    });

    await transport.flush();

    expect(logSpy).toHaveBeenCalled();
  });

  it('should auto-flush when buffer is full', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    for (let i = 0; i < 100; i++) {
      transport.log({
        timestamp: new Date().toISOString(),
        level: LogLevel.INFO,
        message: `msg ${i}`,
        context: {},
      });
    }

    expect(logSpy).toHaveBeenCalled();
  });

  it('should stop timer on stop', () => {
    expect(() => transport.stop()).not.toThrow();
  });
});

describe('FileTransport', () => {
  beforeEach(() => {
    vi.mock('fs', () => ({
      appendFileSync: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create file transport', () => {
    const transport = new FileTransport('/tmp/test.log');

    expect(transport).toBeInstanceOf(FileTransport);
  });

  it('should log entries', async () => {
    const transport = new FileTransport('/tmp/test.log');

    transport.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message: 'test',
      context: {},
    });

    await transport.flush();
  });
});

describe('RemoteTransport', () => {
  let transport: RemoteTransport;

  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);
    transport = new RemoteTransport('http://localhost:8080/logs', 50, 5000);
  });

  afterEach(() => {
    transport.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should create remote transport', () => {
    expect(transport).toBeInstanceOf(RemoteTransport);
  });

  it('should batch and send logs', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);

    await transport.flush();

    expect(global.fetch).toHaveBeenCalled();
  });

  it('should stop timer on stop', () => {
    expect(() => transport.stop()).not.toThrow();
  });
});

describe('createLogger', () => {
  it('should create logger with defaults', () => {
    const transport = { log: vi.fn(), flush: vi.fn().mockResolvedValue(undefined) };
    const logger = createLogger({ transports: [transport as any] });

    expect(logger).toBeInstanceOf(Logger);
  });

  it('should apply default sensitive fields', () => {
    const transport = { log: vi.fn(), flush: vi.fn().mockResolvedValue(undefined) };
    const logger = createLogger({ transports: [transport as any] });

    logger.info('test', { password: 'secret' });

    const entry = transport.log.mock.calls[0][0];
    expect(entry.context.password).toBe('***REDACTED***');
  });
});

describe('generateTraceId', () => {
  it('should generate unique trace IDs', () => {
    const id1 = generateTraceId();
    const id2 = generateTraceId();

    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^trace-\d+-[a-z0-9]+$/);
  });
});

describe('generateSpanId', () => {
  it('should generate unique span IDs', () => {
    const id1 = generateSpanId();
    const id2 = generateSpanId();

    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^span-[a-z0-9]+$/);
  });
});

describe('LogLevel', () => {
  it('should have correct values', () => {
    expect(LogLevel.DEBUG).toBe('DEBUG');
    expect(LogLevel.INFO).toBe('INFO');
    expect(LogLevel.WARN).toBe('WARN');
    expect(LogLevel.ERROR).toBe('ERROR');
  });
});
