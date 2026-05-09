/**
 * @fileOverview 安全中间件 - Agent执行过程的安全检查中间件
 * @module middleware/security
 * @description 提供统一的安全检查功能，包括输入验证、敏感信息过滤、权限检查等
 */

import type { ExecutionContext, ExecutionResult, Middleware } from '../core/interfaces';

export interface SecurityMiddlewareConfig {
  enableInputValidation?: boolean;
  enableOutputValidation?: boolean;
  enableSensitiveDataDetection?: boolean;
  enablePermissionCheck?: boolean;
  enableRateLimiting?: boolean;
  enableInjectionPrevention?: boolean;
  blockedPatterns?: RegExp[];
  allowedPatterns?: RegExp[];
  sensitiveFields?: string[];
  maxInputLength?: number;
  maxOutputLength?: number;
  requireAuth?: boolean;
  allowedRoles?: string[];
  customValidators?: SecurityValidator[];
  onSecurityViolation?: (violation: SecurityViolation) => void;
}

export interface SecurityViolation {
  type: SecurityViolationType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
  requestId?: string;
  blocked: boolean;
}

export type SecurityViolationType =
  | 'input_too_long'
  | 'output_too_long'
  | 'sensitive_data_detected'
  | 'injection_detected'
  | 'forbidden_pattern'
  | 'unauthorized_access'
  | 'rate_limit_exceeded'
  | 'invalid_input'
  | 'custom_validation_failed';

export interface SecurityValidator {
  name: string;
  validate: (input: unknown, context?: ExecutionContext) => ValidationResult;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  blockOnFailure?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

export class SecurityMiddleware implements Middleware {
  readonly name = 'SecurityMiddleware';
  readonly priority: number;
  
  private config: Required<SecurityMiddlewareConfig>;
  private violations: SecurityViolation[];
  private blockedPatterns: RegExp[];
  private allowedPatterns: RegExp[];

  constructor(config: SecurityMiddlewareConfig = {}) {
    this.config = {
      enableInputValidation: config.enableInputValidation !== false,
      enableOutputValidation: config.enableOutputValidation !== false,
      enableSensitiveDataDetection: config.enableSensitiveDataDetection !== false,
      enablePermissionCheck: config.enablePermissionCheck !== false,
      enableRateLimiting: config.enableRateLimiting !== false,
      enableInjectionPrevention: config.enableInjectionPrevention !== false,
      blockedPatterns: config.blockedPatterns || [],
      allowedPatterns: config.allowedPatterns || [],
      sensitiveFields: config.sensitiveFields || [
        'password', 'passwd', 'secret', 'token', 'apiKey', 'api_key',
        'accessToken', 'access_token', 'refreshToken', 'refresh_token',
        'privateKey', 'private_key', 'secretKey', 'secret_key',
        'authorization', 'credentials', 'creditCard', 'credit_card',
        'ssn', 'socialSecurityNumber'
      ],
      maxInputLength: config.maxInputLength || 1000000,
      maxOutputLength: config.maxOutputLength || 1000000,
      requireAuth: config.requireAuth !== false,
      allowedRoles: config.allowedRoles || [],
      customValidators: config.customValidators || [],
      onSecurityViolation: config.onSecurityViolation || (() => {}),
    };
    
    this.priority = 1000;
    this.violations = [];
    this.blockedPatterns = this.config.blockedPatterns;
    this.allowedPatterns = this.config.allowedPatterns;
  }

  async handle(
    context: ExecutionContext,
    next: () => Promise<ExecutionResult>
  ): Promise<ExecutionResult> {
    if (this.config.enableInputValidation) {
      this.validateInput(context);
    }

    if (this.config.enablePermissionCheck) {
      this.checkPermissions(context);
    }

    const result = await next();

    if (this.config.enableOutputValidation) {
      this.validateOutput(result);
    }

    return result;
  }

  private validateInput(context: ExecutionContext): void {
    const messages = context.messages;
    const lastMessage = messages[messages.length - 1];
    
    if (!lastMessage) return;

    const content = typeof lastMessage.content === 'string' 
      ? lastMessage.content 
      : JSON.stringify(lastMessage.content);

    if (content.length > this.config.maxInputLength) {
      this.reportViolation({
        type: 'input_too_long',
        severity: 'high',
        message: `Input length ${content.length} exceeds maximum ${this.config.maxInputLength}`,
        details: { length: content.length, maxLength: this.config.maxInputLength },
        timestamp: Date.now(),
        requestId: context.requestId,
        blocked: true,
      });
      throw new SecurityError('Input validation failed: content too long', 'input_too_long');
    }

    if (this.config.enableSensitiveDataDetection) {
      this.detectSensitiveData(content, context.requestId);
    }

    if (this.config.enableInjectionPrevention) {
      this.checkInjectionPatterns(content, context.requestId);
    }

    if (this.blockedPatterns.length > 0) {
      this.checkBlockedPatterns(content, context.requestId);
    }

    for (const validator of this.config.customValidators) {
      const result = validator.validate(lastMessage.content, context);
      if (!result.valid) {
        this.reportViolation({
          type: 'custom_validation_failed',
          severity: validator.severity || 'medium',
          message: result.message || `Custom validation failed: ${validator.name}`,
          details: result.details,
          timestamp: Date.now(),
          requestId: context.requestId,
          blocked: validator.blockOnFailure || false,
        });
        
        if (validator.blockOnFailure) {
          throw new SecurityError(
            result.message || `Custom validation failed: ${validator.name}`,
            'custom_validation_failed'
          );
        }
      }
    }
  }

  private validateOutput(result: ExecutionResult): void {
    const content = typeof result.output.content === 'string'
      ? result.output.content
      : JSON.stringify(result.output.content);

    if (content.length > this.config.maxOutputLength) {
      this.reportViolation({
        type: 'output_too_long',
        severity: 'medium',
        message: `Output length ${content.length} exceeds maximum ${this.config.maxOutputLength}`,
        details: { length: content.length, maxLength: this.config.maxOutputLength },
        timestamp: Date.now(),
        requestId: result.requestId,
        blocked: false,
      });
    }

    if (this.config.enableSensitiveDataDetection) {
      this.detectSensitiveData(content, result.requestId);
    }
  }

  private detectSensitiveData(content: string, requestId?: string): void {
    for (const field of this.config.sensitiveFields) {
      const pattern = new RegExp(`${field}\\s*[:=]\\s*['"]?([^'\"\\s,}]+)`, 'gi');
      let match;
      
      while ((match = pattern.exec(content)) !== null) {
        const value = match[1];
        if (value && value.length > 3) {
          const maskedValue = value.substring(0, 3) + '*'.repeat(Math.min(value.length - 3, 8));
          
          this.reportViolation({
            type: 'sensitive_data_detected',
            severity: 'critical',
            message: `Sensitive data detected: ${field}`,
            details: {
              field,
              maskedValue,
              position: match.index,
            },
            timestamp: Date.now(),
            requestId,
            blocked: false,
          });
        }
      }
    }
  }

  private checkInjectionPatterns(content: string, requestId?: string): void {
    const injectionPatterns = [
      { pattern: /<\s*script/i, name: 'script_tag' },
      { pattern: /javascript\s*:/i, name: 'javascript_protocol' },
      { pattern: /on\w+\s*=/i, name: 'event_handler' },
      { pattern: /<\s*iframe/i, name: 'iframe_tag' },
      { pattern: /<\s*object/i, name: 'object_tag' },
      { pattern: /<\s*embed/i, name: 'embed_tag' },
      { pattern: /data\s*:/i, name: 'data_protocol' },
      { pattern: /vbscript\s*:/i, name: 'vbscript_protocol' },
      { pattern: /\$\{.*\}/, name: 'template_injection' },
      { pattern: /\$\(.*\)/, name: 'command_injection' },
    ];

    for (const { pattern, name } of injectionPatterns) {
      if (pattern.test(content)) {
        this.reportViolation({
          type: 'injection_detected',
          severity: 'critical',
          message: `Potential injection attack detected: ${name}`,
          details: { pattern: name, matched: pattern.source },
          timestamp: Date.now(),
          requestId,
          blocked: true,
        });
        
        throw new SecurityError(
          `Security violation: potential injection detected`,
          'injection_detected'
        );
      }
    }
  }

  private checkBlockedPatterns(content: string, requestId?: string): void {
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(content)) {
        this.reportViolation({
          type: 'forbidden_pattern',
          severity: 'high',
          message: `Content matches forbidden pattern`,
          details: { pattern: pattern.source },
          timestamp: Date.now(),
          requestId,
          blocked: true,
        });
        
        throw new SecurityError(
          'Security violation: forbidden pattern detected',
          'forbidden_pattern'
        );
      }
    }
  }

  private checkPermissions(context: ExecutionContext): void {
    if (!this.config.requireAuth) return;

    const userId = context.userId;
    if (!userId) {
      this.reportViolation({
        type: 'unauthorized_access',
        severity: 'high',
        message: 'No user ID provided',
        timestamp: Date.now(),
        requestId: context.requestId,
        blocked: true,
      });
      
      throw new SecurityError('Unauthorized: user ID required', 'unauthorized_access');
    }

    if (this.config.allowedRoles.length > 0) {
      const roles = (context.metadata?.roles as string[]) || [];
      const hasPermission = this.config.allowedRoles.some(role => roles.includes(role));
      
      if (!hasPermission) {
        this.reportViolation({
          type: 'unauthorized_access',
          severity: 'high',
          message: 'Insufficient permissions',
          details: { requiredRoles: this.config.allowedRoles, userRoles: roles },
          timestamp: Date.now(),
          requestId: context.requestId,
          blocked: true,
        });
        
        throw new SecurityError('Forbidden: insufficient permissions', 'unauthorized_access');
      }
    }
  }

  private reportViolation(violation: SecurityViolation): void {
    this.violations.push(violation);
    this.config.onSecurityViolation(violation);
  }

  addBlockedPattern(pattern: RegExp): void {
    this.blockedPatterns.push(pattern);
  }

  addAllowedPattern(pattern: RegExp): void {
    this.allowedPatterns.push(pattern);
  }

  addSensitiveField(field: string): void {
    if (!this.config.sensitiveFields.includes(field)) {
      this.config.sensitiveFields.push(field);
    }
  }

  addCustomValidator(validator: SecurityValidator): void {
    this.config.customValidators.push(validator);
  }

  getViolations(requestId?: string): SecurityViolation[] {
    if (requestId) {
      return this.violations.filter(v => v.requestId === requestId);
    }
    return [...this.violations];
  }

  clearViolations(requestId?: string): void {
    if (requestId) {
      this.violations = this.violations.filter(v => v.requestId !== requestId);
    } else {
      this.violations = [];
    }
  }

  getViolationsByType(type: SecurityViolationType): SecurityViolation[] {
    return this.violations.filter(v => v.type === type);
  }

  getViolationsBySeverity(severity: SecurityViolation['severity']): SecurityViolation[] {
    return this.violations.filter(v => v.severity === severity);
  }
}

export class SecurityError extends Error {
  code: string;
  severity: SecurityViolation['severity'];
  timestamp: number;
  requestId?: string;

  constructor(
    message: string,
    code: string,
    severity: SecurityViolation['severity'] = 'high'
  ) {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
    this.severity = severity;
    this.timestamp = Date.now();
  }
}

export function createSecurityMiddleware(config?: SecurityMiddlewareConfig): SecurityMiddleware {
  return new SecurityMiddleware(config);
}

export function createInputSanitizer(config?: {
  removeScripts?: boolean;
  removeHtml?: boolean;
  normalizeWhitespace?: boolean;
  trimLength?: number;
}) {
  return {
    sanitize: (input: string): string => {
      let result = input;
      
      if (config?.removeScripts) {
        result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      }
      
      if (config?.removeHtml) {
        result = result.replace(/<[^>]*>/g, '');
      }
      
      if (config?.normalizeWhitespace) {
        result = result.replace(/\s+/g, ' ').trim();
      }
      
      if (config?.trimLength && result.length > config.trimLength) {
        result = result.substring(0, config.trimLength);
      }
      
      return result;
    },
  };
}

export function createOutputFilter(config?: {
  maskSensitiveData?: boolean;
  sensitiveFields?: string[];
  maskCharacter?: string;
}) {
  const sensitiveFields = config?.sensitiveFields || [
    'password', 'token', 'secret', 'apiKey', 'creditCard'
  ];
  const maskChar = config?.maskCharacter || '*';

  return {
    filter: (output: Record<string, unknown>): Record<string, unknown> => {
      const result: Record<string, unknown> = {};
      
      for (const [key, value] of Object.entries(output)) {
        if (config?.maskSensitiveData && 
            sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          result[key] = maskChar.repeat(8);
        } else if (typeof value === 'object' && value !== null) {
          result[key] = createOutputFilter(config).filter(value as Record<string, unknown>);
        } else {
          result[key] = value;
        }
      }
      
      return result;
    },
  };
}
