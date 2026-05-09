export {
  Sanitizer,
  SanitizationStrategy,
  SanitizationRule,
  SensitivePattern,
  SanitizedResult,
  SanitizerConfig,
  DEFAULT_SENSITIVE_PATTERNS,
  defaultSanitizer,
  sanitize,
  sanitizeLog,
} from './sanitizer';

export {
  InputValidator,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationErrorType,
  ValidationWarningType,
  ValidationRule,
  InputValidatorConfig,
  defaultValidator,
  validate,
  validatePrompt,
} from './validator';

export {
  PermissionChecker,
  Permission,
  Role,
  Principal,
  Resource,
  ActionType,
  ResourceType,
  PrincipalType,
  PermissionCheckRequest,
  PermissionCheckResult,
  PermissionChangeEvent,
  PermissionChangeListener,
  BUILT_IN_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  defaultPermissionChecker,
  checkPermission,
  canAccess,
} from './permissions';

export {
  SecurityInterceptor,
  SecurityError,
  SecurityEvent,
  SecurityEventType,
  InterceptorConfig,
  InterceptedRequest,
  InterceptedResponse,
  RequestInterceptor,
  ResponseInterceptor,
  ErrorHandler,
  defaultInterceptor,
  createSecurityMiddleware,
} from './interceptor';

import { Sanitizer, defaultSanitizer, sanitize, sanitizeLog } from './sanitizer';
import { InputValidator, defaultValidator, validate, validatePrompt } from './validator';
import {
  PermissionChecker,
  defaultPermissionChecker,
  checkPermission,
  canAccess,
} from './permissions';
import {
  SecurityInterceptor,
  SecurityError,
  defaultInterceptor,
  createSecurityMiddleware,
} from './interceptor';

export interface SecurityModuleConfig {
  sanitizer?: ConstructorParameters<typeof Sanitizer>[0];
  validator?: ConstructorParameters<typeof InputValidator>[0];
  interceptor?: ConstructorParameters<typeof SecurityInterceptor>[0];
}

export class SecurityModule {
  public sanitizer: Sanitizer;
  public validator: InputValidator;
  public permissionChecker: PermissionChecker;
  public interceptor: SecurityInterceptor;

  constructor(config?: SecurityModuleConfig) {
    this.sanitizer = new Sanitizer(config?.sanitizer);
    this.validator = new InputValidator(config?.validator);
    this.permissionChecker = new PermissionChecker();
    this.interceptor = new SecurityInterceptor(config?.interceptor);
  }

  static getInstance(): SecurityModule {
    if (!(globalThis as Record<string, unknown>).__securityModuleInstance) {
      (globalThis as Record<string, unknown>).__securityModuleInstance = new SecurityModule();
    }
    return (globalThis as Record<string, unknown>).__securityModuleInstance as SecurityModule;
  }

  async initialize(): Promise<void> {
    this.interceptor.addRequestInterceptor(async (request) => {
      if (request.body) {
        const validation = this.validator.validate(request.body);
        if (!validation.valid) {
          for (const error of validation.errors) {
            if (error.severity === 'critical') {
              throw new SecurityError(
                `安全验证失败: ${error.message}`,
                error.code,
                400
              );
            }
          }
        }
      }
      return request;
    });
  }

  shutdown(): void {
    this.interceptor.clearSecurityEvents();
  }
}

export function createSecurityModule(config?: SecurityModuleConfig): SecurityModule {
  return new SecurityModule(config);
}

export {
  Sanitizer as SensitiveDataSanitizer,
  InputValidator as SecurityValidator,
  PermissionChecker as AccessController,
  SecurityInterceptor as RequestInterceptor,
};

export const securityDefaults = {
  sanitizer: defaultSanitizer,
  validator: defaultValidator,
  permissionChecker: defaultPermissionChecker,
  interceptor: defaultInterceptor,
};

export {
  sanitize,
  sanitizeLog,
  validate,
  validatePrompt,
  checkPermission,
  canAccess,
  createSecurityMiddleware,
};
