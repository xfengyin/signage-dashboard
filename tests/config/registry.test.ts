import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ConfigRegistry,
  ConfigValidator,
  createRegistry,
  createValidator,
  ConfigChangeListener,
} from '../../src/config/registry';

describe('ConfigRegistry', () => {
  let registry: ConfigRegistry;

  beforeEach(() => {
    registry = createRegistry();
  });

  describe('register', () => {
    it('should register configuration', () => {
      registry.register('database', { host: 'localhost', port: 5432 });

      expect(registry.has('database')).toBe(true);
    });

    it('should register multiple configs', () => {
      registry.register('db', { host: 'localhost' });
      registry.register('cache', { host: 'redis.local' });

      expect(registry.has('db')).toBe(true);
      expect(registry.has('cache')).toBe(true);
    });
  });

  describe('get', () => {
    it('should get registered config', () => {
      registry.register('db', { host: 'localhost', port: 5432 });

      const config = registry.get('db');

      expect(config).toEqual({ host: 'localhost', port: 5432 });
    });

    it('should return undefined for missing config', () => {
      const config = registry.get('non-existent');

      expect(config).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for registered config', () => {
      registry.register('test', { value: 1 });

      expect(registry.has('test')).toBe(true);
    });

    it('should return false for unregistered config', () => {
      expect(registry.has('missing')).toBe(false);
    });
  });

  describe('update', () => {
    it('should update existing config', () => {
      registry.register('db', { host: 'localhost', port: 5432 });
      registry.update('db', { host: 'remotehost', port: 3306 });

      const config = registry.get('db');
      expect(config).toEqual({ host: 'remotehost', port: 3306 });
    });

    it('should register if not exists', () => {
      registry.update('new-config', { key: 'value' });

      expect(registry.has('new-config')).toBe(true);
    });

    it('should notify listeners on update', () => {
      const listener = vi.fn();
      registry.onUpdate(listener);

      registry.register('test', { value: 1 });
      registry.update('test', { value: 2 });

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete registered config', () => {
      registry.register('test', { value: 1 });
      registry.delete('test');

      expect(registry.has('test')).toBe(false);
    });

    it('should return false for missing config', () => {
      const result = registry.delete('missing');

      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all configs', () => {
      registry.register('db', { host: 'localhost' });
      registry.register('cache', { host: 'redis' });
      registry.clear();

      expect(registry.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('should return count of registered configs', () => {
      registry.register('a', {});
      registry.register('b', {});
      registry.register('c', {});

      expect(registry.size()).toBe(3);
    });
  });

  describe('keys', () => {
    it('should return all config keys', () => {
      registry.register('db', {});
      registry.register('cache', {});

      const keys = registry.keys();

      expect(keys).toContain('db');
      expect(keys).toContain('cache');
    });
  });

  describe('values', () => {
    it('should return all config values', () => {
      registry.register('db', { host: 'localhost' });
      registry.register('cache', { host: 'redis' });

      const values = registry.values();

      expect(values).toContainEqual({ host: 'localhost' });
      expect(values).toContainEqual({ host: 'redis' });
    });
  });

  describe('entries', () => {
    it('should return all config entries', () => {
      registry.register('db', { host: 'localhost' });

      const entries = registry.entries();

      expect(entries).toContainEqual(['db', { host: 'localhost' }]);
    });
  });

  describe('onUpdate', () => {
    it('should register update listener', () => {
      const listener = vi.fn();
      const unsubscribe = registry.onUpdate(listener);

      registry.register('test', { value: 1 });
      registry.update('test', { value: 2 });

      expect(listener).toHaveBeenCalledTimes(2);

      unsubscribe();
    });
  });

  describe('onRegister', () => {
    it('should register register listener', () => {
      const listener = vi.fn();
      registry.onRegister(listener);

      registry.register('test', { value: 1 });

      expect(listener).toHaveBeenCalledWith('test', { value: 1 });
    });
  });

  describe('onDelete', () => {
    it('should register delete listener', () => {
      const listener = vi.fn();
      registry.onDelete(listener);

      registry.register('test', { value: 1 });
      registry.delete('test');

      expect(listener).toHaveBeenCalledWith('test');
    });
  });
});

describe('ConfigValidator', () => {
  let validator: ConfigValidator;

  beforeEach(() => {
    validator = createValidator();
  });

  describe('validate', () => {
    it('should validate config against schema', () => {
      const schema = {
        type: 'object',
        properties: {
          host: { type: 'string' },
          port: { type: 'number' },
        },
        required: ['host', 'port'],
      };

      const result = validator.validate(
        { host: 'localhost', port: 5432 },
        schema
      );

      expect(result.valid).toBe(true);
    });

    it('should return errors for invalid config', () => {
      const schema = {
        type: 'object',
        properties: {
          host: { type: 'string' },
          port: { type: 'number' },
        },
        required: ['host', 'port'],
      };

      const result = validator.validate(
        { host: 'localhost' },
        schema
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate nested objects', () => {
      const schema = {
        type: 'object',
        properties: {
          database: {
            type: 'object',
            properties: {
              host: { type: 'string' },
            },
          },
        },
      };

      const result = validator.validate(
        { database: { host: 'localhost' } },
        schema
      );

      expect(result.valid).toBe(true);
    });

    it('should validate array items', () => {
      const schema = {
        type: 'object',
        properties: {
          servers: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      };

      const result = validator.validate(
        { servers: ['server1', 'server2'] },
        schema
      );

      expect(result.valid).toBe(true);
    });

    it('should validate enum values', () => {
      const schema = {
        type: 'object',
        properties: {
          environment: {
            type: 'string',
            enum: ['development', 'staging', 'production'],
          },
        },
      };

      expect(
        validator.validate({ environment: 'development' }, schema).valid
      ).toBe(true);
      expect(
        validator.validate({ environment: 'invalid' }, schema).valid
      ).toBe(false);
    });
  });

  describe('addRule', () => {
    it('should add custom validation rule', () => {
      validator.addRule('custom', (config) => {
        return config.value > 0;
      });

      expect(validator.validate({ value: 1 }, { type: 'object' })).toBeDefined();
    });
  });

  describe('getRules', () => {
    it('should return all validation rules', () => {
      validator.addRule('rule1', () => true);
      validator.addRule('rule2', () => true);

      const rules = validator.getRules();

      expect(rules.length).toBe(2);
    });
  });

  describe('clearRules', () => {
    it('should clear all custom rules', () => {
      validator.addRule('rule1', () => true);
      validator.clearRules();

      const rules = validator.getRules();

      expect(rules.length).toBe(0);
    });
  });
});

describe('createRegistry', () => {
  it('should create a new registry', () => {
    const registry = createRegistry();

    expect(registry).toBeInstanceOf(ConfigRegistry);
  });
});

describe('createValidator', () => {
  it('should create a new validator', () => {
    const validator = createValidator();

    expect(validator).toBeInstanceOf(ConfigValidator);
  });
});
