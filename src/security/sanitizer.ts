export type SanitizationStrategy = 'mask' | 'remove' | 'replace' | 'hash' | 'custom';

export interface SanitizationRule {
  field: string | RegExp;
  strategy: SanitizationStrategy;
  replacement?: string;
  maskChar?: string;
  maskRatio?: number;
  customFn?: (value: unknown) => unknown;
}

export interface SensitivePattern {
  name: string;
  pattern: RegExp;
  description: string;
}

export interface SanitizedResult<T = unknown> {
  original: T;
  sanitized: T;
  maskedFields: string[];
  timestamp: Date;
}

export interface SanitizerConfig {
  defaultStrategy: SanitizationStrategy;
  defaultMaskChar?: string;
  defaultMaskRatio?: number;
  caseSensitive?: boolean;
  strictMode?: boolean;
}

export const DEFAULT_SENSITIVE_PATTERNS: SensitivePattern[] = [
  { name: 'password', pattern: /(?:"?password"?\s*[:=]\s*["']?)([^\s,"']+)/gi, description: '密码字段' },
  { name: 'token', pattern: /(?:"?token"?\s*[:=]\s*["']?)([^\s,"']+)/gi, description: '令牌' },
  { name: 'apiKey', pattern: /(?:"?api_?key"?\s*[:=]\s*["']?)([^\s,"']+)/gi, description: 'API密钥' },
  { name: 'secret', pattern: /(?:"?secret"?\s*[:=]\s*["']?)([^\s,"']+)/gi, description: '密钥' },
  { name: 'credential', pattern: /(?:"?credential"?\s*[:=]\s*["']?)([^\s,"']+)/gi, description: '凭证' },
  { name: 'authorization', pattern: /(?:authorization\s*[:=]\s*["']?)([^\s,"']+)/gi, description: '认证头' },
  { name: 'bearer', pattern: /(?:bearer\s+)([^\s,"']+)/gi, description: 'Bearer令牌' },
  { name: 'awsKey', pattern: /(?:aws_?access_?key_?id\s*[:=]\s*["']?)([^\s,"']+)/gi, description: 'AWS访问密钥' },
  { name: 'awsSecret', pattern: /(?:aws_?secret_?access_?key\s*[:=]\s*["']?)([^\s,"']+)/gi, description: 'AWS秘密密钥' },
  { name: 'privateKey', pattern: /(?:private_?key\s*[:=]\s*["']?)([^\s,"']+)/gi, description: '私钥' },
  { name: 'bearer', pattern: /bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi, description: 'JWT令牌' },
  { name: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, description: '邮箱地址' },
  { name: 'phone', pattern: /1[3-9]\d{9}/g, description: '手机号码' },
  { name: 'idCard', pattern: /[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]/g, description: '身份证号' },
  { name: 'creditCard', pattern: /\b(?:\d{4}[- ]?){3}\d{4}\b/g, description: '信用卡号' },
  { name: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, description: '社会安全号' },
  { name: 'ip', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, description: 'IP地址' },
];

export class Sanitizer {
  private config: SanitizerConfig;
  private rules: Map<string, SanitizationRule>;
  private customRules: SanitizationRule[];
  private sensitivePatterns: SensitivePattern[];

  constructor(config: Partial<SanitizerConfig> = {}) {
    this.config = {
      defaultStrategy: 'mask',
      defaultMaskChar: '*',
      defaultMaskRatio: 0.7,
      caseSensitive: false,
      strictMode: true,
      ...config,
    };
    this.rules = new Map();
    this.customRules = [];
    this.sensitivePatterns = [...DEFAULT_SENSITIVE_PATTERNS];
  }

  addRule(field: string | RegExp, rule: Omit<SanitizationRule, 'field'>): void {
    this.rules.set(typeof field === 'string' ? field : field.source, {
      field,
      ...rule,
    });
  }

  addCustomRule(rule: SanitizationRule): void {
    this.customRules.push(rule);
  }

  addSensitivePattern(pattern: SensitivePattern): void {
    this.sensitivePatterns.push(pattern);
  }

  removeSensitivePattern(name: string): boolean {
    const index = this.sensitivePatterns.findIndex(p => p.name === name);
    if (index !== -1) {
      this.sensitivePatterns.splice(index, 1);
      return true;
    }
    return false;
  }

  private getRuleForField(fieldPath: string): SanitizationRule | undefined {
    if (this.rules.has(fieldPath)) {
      return this.rules.get(fieldPath);
    }

    for (const [key, rule] of this.rules) {
      if (rule.field instanceof RegExp) {
        if (rule.field.test(fieldPath)) {
          return rule;
        }
      }
    }

    return undefined;
  }

  private applyStrategy(
    value: unknown,
    strategy: SanitizationStrategy,
    options: SanitizationRule
  ): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    switch (strategy) {
      case 'mask':
        return this.maskValue(String(value), options.maskChar || '*', options.maskRatio || 0.7);
      case 'remove':
        return undefined;
      case 'replace':
        return options.replacement ?? '[REDACTED]';
      case 'hash':
        return this.hashValue(String(value));
      case 'custom':
        return options.customFn ? options.customFn(value) : value;
      default:
        return value;
    }
  }

  private maskValue(value: string, maskChar: string, ratio: number): string {
    if (value.length === 0) return value;
    if (value.length <= 2) return maskChar.repeat(value.length);

    const visibleCount = Math.ceil(value.length * (1 - ratio));
    const maskedCount = value.length - visibleCount;

    return maskChar.repeat(maskedCount) + value.slice(-visibleCount);
  }

  private hashValue(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `hash_${Math.abs(hash).toString(16)}`;
  }

  sanitizeObject<T extends Record<string, unknown>>(
    obj: T,
    parentPath = ''
  ): SanitizedResult<T> {
    const sanitized = { ...obj } as Record<string, unknown>;
    const maskedFields: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = parentPath ? `${parentPath}.${key}` : key;
      const rule = this.getRuleForField(fieldPath);

      if (rule) {
        sanitized[key] = this.applyStrategy(value, rule.strategy, rule);
        maskedFields.push(fieldPath);
      } else if (this.isSensitiveField(key)) {
        const sensitiveRule: SanitizationRule = {
          field: key,
          strategy: this.config.defaultStrategy,
          maskChar: this.config.defaultMaskChar,
          maskRatio: this.config.defaultMaskRatio,
        };
        sanitized[key] = this.applyStrategy(value, sensitiveRule.strategy, sensitiveRule);
        maskedFields.push(fieldPath);
      } else if (typeof value === 'object' && value !== null) {
        const nestedResult = this.sanitizeObject(
          value as Record<string, unknown>,
          fieldPath
        );
        sanitized[key] = nestedResult.sanitized;
        maskedFields.push(...nestedResult.maskedFields);
      }
    }

    return {
      original: obj,
      sanitized: sanitized as T,
      maskedFields,
      timestamp: new Date(),
    };
  }

  sanitizeString(input: string, applyPatterns = true): SanitizedResult<string> {
    let sanitized = input;
    const maskedFields: string[] = [];

    if (applyPatterns) {
      for (const pattern of this.sensitivePatterns) {
        const matches = input.match(pattern.pattern);
        if (matches) {
          for (const match of matches) {
            const masked = this.maskValue(match, this.config.defaultMaskChar || '*', 0.8);
            sanitized = sanitized.replace(match, masked);
            maskedFields.push(`${pattern.name}:${match.slice(0, 4)}...`);
          }
        }
      }
    }

    return {
      original: input,
      sanitized,
      maskedFields,
      timestamp: new Date(),
    };
  }

  sanitizeLog(logMessage: string, context?: Record<string, unknown>): SanitizedResult<string> {
    let sanitized = logMessage;
    const maskedFields: string[] = [];

    for (const pattern of this.sensitivePatterns) {
      const matches = logMessage.match(pattern.pattern);
      if (matches) {
        for (const match of matches) {
          const masked = this.maskValue(match, '*', 0.8);
          sanitized = sanitized.replace(match, masked);
          maskedFields.push(pattern.name);
        }
      }
    }

    if (context) {
      const sanitizedContext = this.sanitizeObject(context);
      maskedFields.push(...sanitizedContext.maskedFields);
    }

    return {
      original: logMessage,
      sanitized,
      maskedFields,
      timestamp: new Date(),
    };
  }

  sanitizeRequest<T = unknown>(request: {
    body?: T;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    params?: Record<string, string>;
  }): SanitizedResult<typeof request> {
    const sanitized: typeof request = {};
    const maskedFields: string[] = [];

    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    if (request.headers) {
      sanitized.headers = { ...request.headers };
      for (const header of sensitiveHeaders) {
        if (sanitized.headers[header]) {
          sanitized.headers[header] = this.applyStrategy(
            sanitized.headers[header],
            this.config.defaultStrategy,
            { strategy: this.config.defaultStrategy, maskChar: '*', maskRatio: 0.9 }
          ) as string;
          maskedFields.push(`headers.${header}`);
        }
      }
    }

    if (request.body) {
      const bodyResult = this.sanitizeObject(request.body as Record<string, unknown>);
      sanitized.body = bodyResult.sanitized as T;
      maskedFields.push(...bodyResult.maskedFields.map(f => `body.${f}`));
    }

    if (request.query) {
      sanitized.query = this.sanitizeObject(request.query).sanitized;
    }

    if (request.params) {
      sanitized.params = this.sanitizeObject(request.params).sanitized;
    }

    return {
      original: request,
      sanitized,
      maskedFields,
      timestamp: new Date(),
    };
  }

  sanitizeResponse<T = unknown>(response: T): SanitizedResult<T> {
    return this.sanitizeObject(response as Record<string, unknown>);
  }

  private isSensitiveField(fieldName: string): boolean {
    const sensitiveKeywords = [
      'password', 'passwd', 'pwd', 'secret', 'token', 'apiKey', 'api_key',
      'apikey', 'credential', 'auth', 'private', 'key', 'signature',
      'accessToken', 'access_token', 'refreshToken', 'refresh_token',
      'bearer', 'authorization', 'cookie', 'session', 'sessionId', 'session_id',
      'csrf', 'xsrf', 'secretKey', 'secret_key', 'encryptionKey',
      'awsAccessKey', 'awsSecretKey', 'clientSecret', 'client_secret',
    ];

    const lowerField = this.config.caseSensitive ? fieldName : fieldName.toLowerCase();
    return sensitiveKeywords.some(keyword => lowerField.includes(keyword));
  }

  setConfig(config: Partial<SanitizerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): SanitizerConfig {
    return { ...this.config };
  }

  clearRules(): void {
    this.rules.clear();
    this.customRules = [];
  }
}

export const defaultSanitizer = new Sanitizer();

export function sanitize<T extends Record<string, unknown>>(
  obj: T,
  config?: Partial<SanitizerConfig>
): SanitizedResult<T> {
  const sanitizer = new Sanitizer(config);
  return sanitizer.sanitizeObject(obj);
}

export function sanitizeLog(
  message: string,
  context?: Record<string, unknown>
): SanitizedResult<string> {
  return defaultSanitizer.sanitizeLog(message, context);
}
