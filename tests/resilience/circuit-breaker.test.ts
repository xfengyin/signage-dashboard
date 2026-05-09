import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerError,
  CircuitBreakerRegistry,
  CircuitBreakerConfig,
} from '../../src/resilience/circuit-breaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  let events: {
    onOpen: ReturnType<typeof vi.fn>;
    onClose: ReturnType<typeof vi.fn>;
    onHalfOpen: ReturnType<typeof vi.fn>;
    onSuccess: ReturnType<typeof vi.fn>;
    onFailure: ReturnType<typeof vi.fn>;
  };

  const defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 1000,
    resetTimeout: 5000,
    monitorInterval: 1000,
  };

  beforeEach(() => {
    events = {
      onOpen: vi.fn(),
      onClose: vi.fn(),
      onHalfOpen: vi.fn(),
      onSuccess: vi.fn(),
      onFailure: vi.fn(),
    };
    circuitBreaker = new CircuitBreaker(defaultConfig, events);
  });

  afterEach(() => {
    CircuitBreakerRegistry.clear();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create circuit breaker with default config', () => {
      const cb = new CircuitBreaker({});
      expect(cb.getState()).toBe(CircuitState.CLOSED);
      expect(cb.getFailureCount()).toBe(0);
      expect(cb.getSuccessCount()).toBe(0);
    });

    it('should create circuit breaker with custom config', () => {
      const cb = new CircuitBreaker(defaultConfig);
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it('should register event handlers', () => {
      expect(events.onOpen).toBeDefined();
      expect(events.onClose).toBeDefined();
      expect(events.onHalfOpen).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should execute operation successfully', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(events.onSuccess).toHaveBeenCalled();
    });

    it('should handle operation failure in CLOSED state', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('test error'));

      await expect(circuitBreaker.execute(operation)).rejects.toThrow('test error');
      expect(circuitBreaker.getFailureCount()).toBe(1);
      expect(events.onFailure).toHaveBeenCalled();
    });

    it('should transition to OPEN after failure threshold', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('test error'));

      for (let i = 0; i < defaultConfig.failureThreshold; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch {}
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      expect(events.onOpen).toHaveBeenCalled();
    });

    it('should execute fallback when circuit is OPEN', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('test error'));
      const fallback = vi.fn().mockResolvedValue('fallback result');

      for (let i = 0; i < defaultConfig.failureThreshold; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch {}
      }

      const result = await circuitBreaker.execute(operation, fallback);

      expect(result).toBe('fallback result');
      expect(fallback).toHaveBeenCalled();
    });

    it('should throw CircuitBreakerError when circuit is OPEN without fallback', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('test error'));

      for (let i = 0; i < defaultConfig.failureThreshold; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch {}
      }

      await expect(circuitBreaker.execute(operation)).rejects.toThrow(CircuitBreakerError);
    });
  });

  describe('HALF_OPEN state', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('test error'));

      for (let i = 0; i < defaultConfig.failureThreshold; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch {}
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      vi.advanceTimersByTime(defaultConfig.resetTimeout);

      const result = await circuitBreaker.execute(vi.fn().mockResolvedValue('success'));

      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
      expect(result).toBe('success');
    });

    it('should transition to CLOSED after success threshold in HALF_OPEN', async () => {
      vi.setSystemTime(0);

      for (let i = 0; i < defaultConfig.failureThreshold; i++) {
        try {
          await circuitBreaker.execute(vi.fn().mockRejectedValue(new Error('error')));
        } catch {}
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      vi.advanceTimersByTime(defaultConfig.resetTimeout);
      vi.advanceTimersByTime(100);

      const successOperation = vi.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successOperation);
      await circuitBreaker.execute(successOperation);

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      expect(events.onClose).toHaveBeenCalled();
    });

    it('should transition back to OPEN on failure in HALF_OPEN', async () => {
      vi.setSystemTime(0);

      for (let i = 0; i < defaultConfig.failureThreshold; i++) {
        try {
          await circuitBreaker.execute(vi.fn().mockRejectedValue(new Error('error')));
        } catch {}
      }

      vi.advanceTimersByTime(defaultConfig.resetTimeout);
      vi.advanceTimersByTime(100);

      await circuitBreaker.execute(vi.fn().mockRejectedValue(new Error('error')));

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('state management', () => {
    it('should report correct state', () => {
      expect(circuitBreaker.isOpen()).toBe(false);
      expect(circuitBreaker.isClosed()).toBe(true);
      expect(circuitBreaker.isHalfOpen()).toBe(false);
    });

    it('should reset state correctly', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('test error'));

      for (let i = 0; i < defaultConfig.failureThreshold; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch {}
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      circuitBreaker.reset();

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.getFailureCount()).toBe(0);
      expect(events.onClose).toHaveBeenCalled();
    });

    it('should force OPEN state', () => {
      circuitBreaker.forceOpen();

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      expect(circuitBreaker.isOpen()).toBe(true);
    });

    it('should force HALF_OPEN state', () => {
      circuitBreaker.forceHalfOpen();

      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
      expect(circuitBreaker.isHalfOpen()).toBe(true);
    });
  });

  describe('metrics', () => {
    it('should return correct metrics', () => {
      const metrics = circuitBreaker.getMetrics();

      expect(metrics.state).toBe(CircuitState.CLOSED);
      expect(metrics.failureCount).toBe(0);
      expect(metrics.successCount).toBe(0);
      expect(metrics.lastFailureTime).toBeUndefined();
    });

    it('should track failure count', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('error'));

      await circuitBreaker.execute(operation).catch(() => {});
      await circuitBreaker.execute(operation).catch(() => {});

      const metrics = circuitBreaker.getMetrics();

      expect(metrics.failureCount).toBe(2);
      expect(metrics.lastFailureTime).toBeDefined();
    });

    it('should track success count', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      await circuitBreaker.execute(operation);
      await circuitBreaker.execute(operation);

      const metrics = circuitBreaker.getMetrics();

      expect(metrics.successCount).toBe(2);
    });
  });

  describe('CircuitBreakerRegistry', () => {
    it('should get or create instance', () => {
      const instance = CircuitBreakerRegistry.getInstance('test-circuit', defaultConfig);

      expect(instance).toBeInstanceOf(CircuitBreaker);
      expect(CircuitBreakerRegistry.hasInstance('test-circuit')).toBe(true);
    });

    it('should return existing instance', () => {
      const instance1 = CircuitBreakerRegistry.getInstance('test-circuit', defaultConfig);
      const instance2 = CircuitBreakerRegistry.getInstance('test-circuit');

      expect(instance1).toBe(instance2);
    });

    it('should throw when instance not found without config', () => {
      expect(() => CircuitBreakerRegistry.getInstance('non-existent')).toThrow();
    });

    it('should remove instance', () => {
      CircuitBreakerRegistry.getInstance('test-circuit', defaultConfig);
      CircuitBreakerRegistry.removeInstance('test-circuit');

      expect(CircuitBreakerRegistry.hasInstance('test-circuit')).toBe(false);
    });

    it('should clear all instances', () => {
      CircuitBreakerRegistry.getInstance('circuit1', defaultConfig);
      CircuitBreakerRegistry.getInstance('circuit2', defaultConfig);
      CircuitBreakerRegistry.clear();

      expect(CircuitBreakerRegistry.hasInstance('circuit1')).toBe(false);
      expect(CircuitBreakerRegistry.hasInstance('circuit2')).toBe(false);
    });

    it('should get all metrics', () => {
      CircuitBreakerRegistry.getInstance('circuit1', defaultConfig);
      CircuitBreakerRegistry.getInstance('circuit2', defaultConfig);

      const allMetrics = CircuitBreakerRegistry.getAllMetrics();

      expect(allMetrics.size).toBe(2);
      expect(allMetrics.has('circuit1')).toBe(true);
      expect(allMetrics.has('circuit2')).toBe(true);
    });
  });

  describe('CircuitBreakerError', () => {
    it('should create error with circuit state', () => {
      const error = new CircuitBreakerError('Circuit open', CircuitState.OPEN);

      expect(error.message).toBe('Circuit open');
      expect(error.circuitState).toBe(CircuitState.OPEN);
      expect(error.name).toBe('CircuitBreakerError');
    });
  });
});
