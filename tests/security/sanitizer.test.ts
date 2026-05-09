import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Sanitizer,
  SanitizationStrategy,
  SanitizedResult,
  defaultSanitizer,
  sanitize,
  sanitizeLog,
  DEFAULT_SENSITIVE_PATTERNS,
  SanitizerConfig,
} from '../../src/security/sanitizer';

describe('Sanitizer', () => {
  let sanitizer: Sanitizer;

  beforeEach(() => {
    sanitizer = new Sanitizer();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create sanitizer with default config', () => {
      const s = new Sanitizer();
      const config = s.getConfig();

      expect(config.defaultStrategy).toBe('mask');
      expect(config.defaultMaskChar).toBe('*');
      expect(config.defaultMaskRatio).toBe(0.7);
      expect(config.caseSensitive).toBe(false);
      expect(config.strictMode).toBe(true);
    });

    it('should create sanitizer with custom config', () => {
      const s = new Sanitizer({
        defaultStrategy: 'remove',
        defaultMaskChar: 'X',
        defaultMaskRatio: 0.5,
        caseSensitive: true,
      });
      const config = s.getConfig();

      expect(config.defaultStrategy).toBe('remove');
      expect(config.defaultMaskChar).toBe('X');
      expect(config.defaultMaskRatio).toBe(0.5);
      expect(config.caseSensitive).toBe(true);
    });
  });

  describe('addRule', () => {
    it('should add string field rule', () => {
      sanitizer.addRule('password', {
        strategy: 'remove',
      });

      const result = sanitizer.sanitizeObject({ password: 'secret123' });

      expect(result.sanitized).not.toHaveProperty('password');
      expect(result.maskedFields).toContain('password');
    });

    it('should add regex field rule', () => {
      sanitizer.addRule(/^secret/, {
        strategy: 'hash',
      });

      const result = sanitizer.sanitizeObject({ secretField: 'value', other: 'data' });

      expect(result.sanitized.secretField).toContain('hash_');
      expect(result.maskedFields).toContain('secretField');
    });
  });

  describe('addCustomRule', () => {
    it('should add custom rule', () => {
      sanitizer.addCustomRule({
        field: 'customField',
        strategy: 'custom',
        customFn: (value) => `custom_${value}`,
      });

      const result = sanitizer.sanitizeObject({ customField: 'test' });

      expect(result.sanitized.customField).toBe('custom_test');
    });
  });

  describe('addSensitivePattern', () => {
    it('should add sensitive pattern', () => {
      sanitizer.addSensitivePattern({
        name: 'customPattern',
        pattern: /test-pattern-\d+/g,
        description: 'Custom test pattern',
      });

      const result = sanitizer.sanitizeString('Token: test-pattern-12345');

      expect(result.sanitized).not.toContain('test-pattern-12345');
      expect(result.maskedFields).toContain('customPattern:test...');
    });
  });

  describe('removeSensitivePattern', () => {
    it('should remove existing pattern', () => {
      const initialLength = DEFAULT_SENSITIVE_PATTERNS.length;
      sanitizer.removeSensitivePattern('password');

      const result = sanitizer.sanitizeString('password=secret123');

      expect(result.sanitized).toBe('password=secret123');
    });

    it('should return false for non-existent pattern', () => {
      const result = sanitizer.removeSensitivePattern('nonExistent');

      expect(result).toBe(false);
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize object with password field', () => {
      const result = sanitizer.sanitizeObject({ username: 'test', password: 'secret' });

      expect(result.sanitized.username).toBe('test');
      expect(result.sanitized.password).toBe('******');
      expect(result.maskedFields).toContain('password');
    });

    it('should sanitize nested objects', () => {
      const result = sanitizer.sanitizeObject({
        user: {
          name: 'John',
          apiKey: 'key123',
        },
      });

      expect(result.sanitized.user.name).toBe('John');
      expect(result.sanitized.user.apiKey).toContain('hash_');
    });

    it('should preserve non-sensitive fields', () => {
      const result = sanitizer.sanitizeObject({
        id: 1,
        name: 'Test',
        email: 'test@example.com',
        status: 'active',
      });

      expect(result.sanitized.id).toBe(1);
      expect(result.sanitized.name).toBe('Test');
      expect(result.sanitized.status).toBe('active');
    });

    it('should handle null and undefined values', () => {
      const result = sanitizer.sanitizeObject({
        field1: null,
        field2: undefined,
        password: 'secret',
      });

      expect(result.sanitized.field1).toBeNull();
      expect(result.sanitized.field2).toBeUndefined();
      expect(result.maskedFields).toContain('password');
    });

    it('should apply mask strategy', () => {
      const s = new Sanitizer({
        defaultStrategy: 'mask',
        defaultMaskRatio: 0.5,
      });
      s.addRule('token', { strategy: 'mask', maskRatio: 0.8 });

      const result = s.sanitizeObject({ token: 'abcdefghij' });

      expect(result.sanitized.token).not.toBe('abcdefghij');
      expect(result.sanitized.token.length).toBeGreaterThan(0);
    });

    it('should apply remove strategy', () => {
      const s = new Sanitizer({ defaultStrategy: 'remove' });
      s.addRule('secret', { strategy: 'remove' });

      const result = s.sanitizeObject({ secret: 'hidden', other: 'visible' });

      expect(result.sanitized).not.toHaveProperty('secret');
      expect(result.sanitized.other).toBe('visible');
    });

    it('should apply replace strategy', () => {
      const s = new Sanitizer();
      s.addRule('code', { strategy: 'replace', replacement: '[REDACTED]' });

      const result = s.sanitizeObject({ code: 'ABC123' });

      expect(result.sanitized.code).toBe('[REDACTED]');
    });

    it('should apply hash strategy', () => {
      const s = new Sanitizer();
      s.addRule('data', { strategy: 'hash' });

      const result = s.sanitizeObject({ data: 'sensitive' });

      expect(result.sanitized.data).toContain('hash_');
    });
  });

  describe('sanitizeString', () => {
    it('should mask passwords', () => {
      const result = sanitizer.sanitizeString('password=mysecretpassword');

      expect(result.sanitized).not.toContain('mysecretpassword');
      expect(result.maskedFields.some(f => f.includes('password'))).toBe(true);
    });

    it('should mask API keys', () => {
      const result = sanitizer.sanitizeString('api_key=sk-1234567890abcdef');

      expect(result.sanitized).not.toContain('sk-1234567890abcdef');
    });

    it('should mask email addresses', () => {
      const result = sanitizer.sanitizeString('Contact: user@example.com');

      expect(result.sanitized).not.toContain('user@example.com');
    });

    it('should mask phone numbers', () => {
      const result = sanitizer.sanitizeString('Phone: 13812345678');

      expect(result.sanitized).not.toContain('13812345678');
    });

    it('should mask credit card numbers', () => {
      const result = sanitizer.sanitizeString('Card: 4111-1111-1111-1111');

      expect(result.sanitized).not.toContain('4111-1111-1111-1111');
    });

    it('should mask JWT tokens', () => {
      const result = sanitizer.sanitizeString('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');

      expect(result.sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    it('should not apply patterns when disabled', () => {
      const result = sanitizer.sanitizeString('email=test@test.com', false);

      expect(result.sanitized).toBe('email=test@test.com');
      expect(result.maskedFields.length).toBe(0);
    });
  });

  describe('sanitizeLog', () => {
    it('should sanitize log message', () => {
      const result = sanitizer.sanitizeLog('User logged in with token abc123');

      expect(result.sanitized).not.toContain('abc123');
    });

    it('should sanitize log with context', () => {
      const result = sanitizer.sanitizeLog('Request processed', {
        password: 'secret',
        userId: 123,
      });

      expect(result.maskedFields).toContain('password');
    });
  });

  describe('sanitizeRequest', () => {
    it('should sanitize request body', () => {
      const result = sanitizer.sanitizeRequest({
        body: { username: 'test', password: 'secret' },
      });

      expect(result.sanitized.body.username).toBe('test');
      expect(result.sanitized.body.password).toBe('******');
    });

    it('should sanitize authorization headers', () => {
      const result = sanitizer.sanitizeRequest({
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer token123',
        },
      });

      expect(result.sanitized.headers['authorization']).toContain('*');
      expect(result.sanitized.headers['content-type']).toBe('application/json');
    });

    it('should sanitize query parameters', () => {
      const result = sanitizer.sanitizeRequest({
        query: { apiKey: 'key123', filter: 'active' },
      });

      expect(result.sanitized.query.apiKey).toContain('*');
      expect(result.sanitized.query.filter).toBe('active');
    });

    it('should sanitize path parameters', () => {
      const result = sanitizer.sanitizeRequest({
        params: { id: '123', secret: 'hidden' },
      });

      expect(result.sanitized.params.secret).toContain('*');
      expect(result.sanitized.params.id).toBe('123');
    });
  });

  describe('sanitizeResponse', () => {
    it('should sanitize response data', () => {
      const result = sanitizer.sanitizeResponse({
        data: { token: 'secret', name: 'Test' },
      });

      expect(result.sanitized.data.token).toContain('*');
      expect(result.sanitized.data.name).toBe('Test');
    });
  });

  describe('setConfig', () => {
    it('should update config', () => {
      sanitizer.setConfig({ defaultStrategy: 'hash' });

      const config = sanitizer.getConfig();

      expect(config.defaultStrategy).toBe('hash');
    });
  });

  describe('clearRules', () => {
    it('should clear all rules', () => {
      sanitizer.addRule('test', { strategy: 'remove' });
      sanitizer.clearRules();

      const result = sanitizer.sanitizeObject({ test: 'value', password: 'secret' });

      expect(result.sanitized.test).toBe('value');
      expect(result.sanitized.password).toBe('******');
    });
  });
});

describe('defaultSanitizer', () => {
  it('should be available for use', () => {
    expect(defaultSanitizer).toBeInstanceOf(Sanitizer);
  });

  it('should sanitize sensitive data', () => {
    const result = defaultSanitizer.sanitizeObject({
      password: 'secret123',
      username: 'test',
    });

    expect(result.sanitized.password).toContain('*');
    expect(result.sanitized.username).toBe('test');
  });
});

describe('sanitize', () => {
  it('should create new sanitizer and sanitize object', () => {
    const result = sanitize({ password: 'secret', name: 'Test' });

    expect(result.sanitized.password).toContain('*');
    expect(result.sanitized.name).toBe('Test');
  });

  it('should accept custom config', () => {
    const result = sanitize({ password: 'secret' }, { defaultStrategy: 'remove' });

    expect(result.sanitized).not.toHaveProperty('password');
  });
});

describe('sanitizeLog', () => {
  it('should sanitize log message using default sanitizer', () => {
    const result = sanitizeLog('Token: sk-1234567890');

    expect(result.sanitized).not.toContain('sk-1234567890');
  });

  it('should sanitize log with context', () => {
    const result = sanitizeLog('Request completed', { secret: 'data' });

    expect(result.maskedFields).toContain('secret');
  });
});

describe('DEFAULT_SENSITIVE_PATTERNS', () => {
  it('should include common sensitive patterns', () => {
    const patternNames = DEFAULT_SENSITIVE_PATTERNS.map(p => p.name);

    expect(patternNames).toContain('password');
    expect(patternNames).toContain('token');
    expect(patternNames).toContain('apiKey');
    expect(patternNames).toContain('secret');
    expect(patternNames).toContain('email');
    expect(patternNames).toContain('phone');
  });

  it('should have valid patterns', () => {
    for (const pattern of DEFAULT_SENSITIVE_PATTERNS) {
      expect(pattern.pattern).toBeInstanceOf(RegExp);
      expect(pattern.name).toBeTruthy();
      expect(pattern.description).toBeTruthy();
    }
  });
});

describe('SanitizedResult', () => {
  it('should have correct structure', () => {
    const result = sanitize({ password: 'secret' });

    expect(result).toHaveProperty('original');
    expect(result).toHaveProperty('sanitized');
    expect(result).toHaveProperty('maskedFields');
    expect(result).toHaveProperty('timestamp');
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('should preserve original data', () => {
    const data = { password: 'secret', name: 'Test' };
    const result = sanitize(data);

    expect(result.original).toEqual(data);
  });
});
