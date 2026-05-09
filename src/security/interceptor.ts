import { InputValidator, ValidationResult } from './validator';
import { PermissionChecker, PermissionCheckRequest, ResourceType, ActionType } from './permissions';
import { Sanitizer } from './sanitizer';

export type SecurityEventType =
  | 'unauthorized_access'
  | 'privilege_escalation'
  | 'prompt_injection'
  | 'sql_injection'
  | 'xss_attack'
  | 'command_injection'
  | 'path_traversal'
  | 'rate_limit_exceeded'
  | 'invalid_input'
  | 'suspicious_activity';

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  source?: string;
  target?: string;
  action?: string;
  details: Record<string, unknown>;
  request?: unknown;
  response?: unknown;
  blocked: boolean;
  userId?: string;
  sessionId?: string;
}

export interface InterceptorConfig {
  enableValidation?: boolean;
  enablePermissionCheck?: boolean;
  enableSanitization?: boolean;
  enableRateLimiting?: boolean;
  enableAuditLog?: boolean;
  maxRequestSize?: number;
  rateLimitWindow?: number;
  rateLimitMaxRequests?: number;
  strictMode?: boolean;
  onSecurityEvent?: (event: SecurityEvent) => void;
}

export interface InterceptedRequest<T = unknown> {
  id: string;
  timestamp: Date;
  method?: string;
  path?: string;
  body?: T;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  params?: Record<string, string>;
  user?: {
    id: string;
    roles?: string[];
  };
  session?: {
    id: string;
    ip?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface InterceptedResponse<T = unknown> {
  id: string;
  timestamp: Date;
  statusCode?: number;
  body?: T;
  headers?: Record<string, string>;
  error?: string;
}

export type RequestInterceptor = (
  request: InterceptedRequest
) => Promise<InterceptedRequest> | InterceptedRequest;

export type ResponseInterceptor = (
  request: InterceptedRequest,
  response: InterceptedResponse
) => Promise<InterceptedResponse> | InterceptedResponse;

export type ErrorHandler = (
  error: SecurityError,
  request: InterceptedRequest
) => Promise<InterceptedResponse> | InterceptedResponse;

export class SecurityError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 403,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class SecurityInterceptor {
  private validator: InputValidator;
  private permissionChecker: PermissionChecker;
  private sanitizer: Sanitizer;
  private config: Required<InterceptorConfig>;
  private requestInterceptors: RequestInterceptor[];
  private responseInterceptors: ResponseInterceptor[];
  private errorHandlers: ErrorHandler[];
  private securityEvents: SecurityEvent[];
  private rateLimitMap: Map<string, { count: number; resetTime: number }>;
  private requestCounter: number;

  constructor(config: InterceptorConfig = {}) {
    this.validator = new InputValidator();
    this.permissionChecker = new PermissionChecker();
    this.sanitizer = new Sanitizer();
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    this.errorHandlers = [];
    this.securityEvents = [];
    this.rateLimitMap = new Map();
    this.requestCounter = 0;

    this.config = {
      enableValidation: config.enableValidation ?? true,
      enablePermissionCheck: config.enablePermissionCheck ?? true,
      enableSanitization: config.enableSanitization ?? true,
      enableRateLimiting: config.enableRateLimiting ?? true,
      enableAuditLog: config.enableAuditLog ?? true,
      maxRequestSize: config.maxRequestSize ?? 1_000_000,
      rateLimitWindow: config.rateLimitWindow ?? 60000,
      rateLimitMaxRequests: config.rateLimitMaxRequests ?? 100,
      strictMode: config.strictMode ?? true,
      onSecurityEvent: config.onSecurityEvent,
    };
  }

  async interceptRequest<T = unknown>(
    request: Omit<InterceptedRequest, 'id' | 'timestamp'>
  ): Promise<InterceptedRequest> {
    const interceptedRequest: InterceptedRequest = {
      ...request,
      id: this.generateRequestId(),
      timestamp: new Date(),
    };

    try {
      for (const interceptor of this.requestInterceptors) {
        interceptedRequest.body = (await interceptor(interceptedRequest)) as T;
      }

      if (this.config.enableSanitization) {
        const sanitized = this.sanitizeRequest(interceptedRequest);
        interceptedRequest.body = sanitized.body;
        interceptedRequest.headers = sanitized.headers;
      }

      if (this.config.enableValidation) {
        this.validateRequest(interceptedRequest);
      }

      if (this.config.enableRateLimiting) {
        this.checkRateLimit(interceptedRequest);
      }

      return interceptedRequest;
    } catch (error) {
      return this.handleError(error as Error, interceptedRequest);
    }
  }

  async interceptResponse<T = unknown>(
    request: InterceptedRequest,
    response: Omit<InterceptedResponse, 'id' | 'timestamp'>
  ): Promise<InterceptedResponse> {
    let interceptedResponse: InterceptedResponse = {
      ...response,
      id: request.id,
      timestamp: new Date(),
    };

    try {
      if (this.config.enableSanitization) {
        interceptedResponse.body = this.sanitizer.sanitizeResponse(response.body).sanitized;
      }

      for (const interceptor of this.responseInterceptors) {
        interceptedResponse = await interceptor(request, interceptedResponse);
      }

      return interceptedResponse;
    } catch (error) {
      this.logSecurityEvent({
        type: 'suspicious_activity',
        severity: 'medium',
        source: request.path,
        action: 'response_intercept',
        details: { error: (error as Error).message },
        request: request,
        response: interceptedResponse,
        blocked: false,
        userId: request.user?.id,
        sessionId: request.session?.id,
      });
      return interceptedResponse;
    }
  }

  private sanitizeRequest(request: InterceptedRequest): InterceptedRequest {
    const sanitized = this.sanitizer.sanitizeRequest({
      body: request.body,
      headers: request.headers,
      query: request.query,
      params: request.params,
    });

    if (sanitized.maskedFields.length > 0) {
      this.logSecurityEvent({
        type: 'suspicious_activity',
        severity: 'low',
        source: request.path,
        action: 'sanitization',
        details: { maskedFields: sanitized.maskedFields },
        request,
        blocked: false,
        userId: request.user?.id,
        sessionId: request.session?.id,
      });
    }

    return {
      ...request,
      body: sanitized.sanitized.body,
      headers: sanitized.sanitized.headers,
      query: sanitized.sanitized.query,
      params: sanitized.sanitized.params,
    };
  }

  private validateRequest(request: InterceptedRequest): void {
    if (request.body) {
      const validationResult = this.validator.validate(request.body);

      if (!validationResult.valid) {
        for (const error of validationResult.errors) {
          this.logSecurityEvent({
            type: this.mapErrorTypeToEventType(error.type),
            severity: error.severity === 'critical' ? 'critical' : 'high',
            source: request.path,
            action: 'input_validation',
            details: {
              code: error.code,
              message: error.message,
              field: error.field,
            },
            request,
            blocked: true,
            userId: request.user?.id,
            sessionId: request.session?.id,
          });

          if (this.config.strictMode) {
            throw new SecurityError(
              `安全验证失败: ${error.message}`,
              error.code,
              400,
              { validationErrors: validationResult.errors }
            );
          }
        }
      }

      for (const warning of validationResult.warnings) {
        this.logSecurityEvent({
          type: 'suspicious_activity',
          severity: 'medium',
          source: request.path,
          action: 'input_validation_warning',
          details: {
            code: warning.code,
            message: warning.message,
            field: warning.field,
          },
          request,
          blocked: false,
          userId: request.user?.id,
          sessionId: request.session?.id,
        });
      }
    }

    if (request.query) {
      const queryValidation = this.validator.validate(request.query);
      if (!queryValidation.valid && this.config.strictMode) {
        throw new SecurityError(
          '查询参数验证失败',
          'INVALID_QUERY',
          400
        );
      }
    }
  }

  private mapErrorTypeToEventType(errorType: string): SecurityEventType {
    const mapping: Record<string, SecurityEventType> = {
      prompt_injection: 'prompt_injection',
      sql_injection: 'sql_injection',
      xss: 'xss_attack',
      command_injection: 'command_injection',
      path_traversal: 'path_traversal',
      invalid_input: 'invalid_input',
      rate_limit: 'rate_limit_exceeded',
    };
    return mapping[errorType] || 'suspicious_activity';
  }

  private checkRateLimit(request: InterceptedRequest): void {
    const key = request.user?.id || request.session?.ip || 'anonymous';
    const now = Date.now();

    let rateLimit = this.rateLimitMap.get(key);

    if (!rateLimit || now > rateLimit.resetTime) {
      rateLimit = {
        count: 1,
        resetTime: now + this.config.rateLimitWindow,
      };
      this.rateLimitMap.set(key, rateLimit);
      return;
    }

    rateLimit.count++;

    if (rateLimit.count > this.config.rateLimitMaxRequests) {
      this.logSecurityEvent({
        type: 'rate_limit_exceeded',
        severity: 'medium',
        source: request.path,
        action: 'rate_limit',
        details: {
          count: rateLimit.count,
          limit: this.config.rateLimitMaxRequests,
          window: this.config.rateLimitWindow,
        },
        request,
        blocked: true,
        userId: request.user?.id,
        sessionId: request.session?.id,
      });

      throw new SecurityError(
        '请求频率超过限制',
        'RATE_LIMIT_EXCEEDED',
        429,
        {
          retryAfter: Math.ceil((rateLimit.resetTime - now) / 1000),
        }
      );
    }
  }

  checkPermission(
    request: InterceptedRequest,
    resourceType: ResourceType,
    action: ActionType,
    resourceId?: string
  ): void {
    if (!this.config.enablePermissionCheck || !request.user) {
      return;
    }

    const permissionRequest: PermissionCheckRequest = {
      principal: {
        id: request.user.id,
        type: 'user',
        roles: request.user.roles,
      },
      resource: {
        id: resourceId || '*',
        type: resourceType,
      },
      action,
      context: {
        ip: request.session?.ip,
        ...request.metadata,
      },
    };

    const result = this.permissionChecker.checkPermission(permissionRequest);

    if (!result.allowed) {
      this.logSecurityEvent({
        type: 'unauthorized_access',
        severity: result.reason.includes('权限提升') ? 'critical' : 'high',
        source: request.path,
        target: resourceId,
        action: `${resourceType}:${action}`,
        details: {
          reason: result.reason,
          principal: request.user.id,
          resource: `${resourceType}:${resourceId || '*'}`,
        },
        request,
        blocked: true,
        userId: request.user?.id,
        sessionId: request.session?.id,
      });

      throw new SecurityError(
        `权限不足: ${result.reason}`,
        'PERMISSION_DENIED',
        403,
        {
          resourceType,
          action,
          resourceId,
        }
      );
    }

    if (result.evaluatedConditions) {
      const failedConditions = result.evaluatedConditions.filter(c => !c.passed);
      if (failedConditions.length > 0) {
        this.logSecurityEvent({
          type: 'privilege_escalation',
          severity: 'high',
          source: request.path,
          action: 'permission_check',
          details: {
            reason: '条件不满足',
            failedConditions: failedConditions.map(c => ({
              type: c.condition.type,
              details: c.details,
            })),
          },
          request,
          blocked: true,
          userId: request.user?.id,
          sessionId: request.session?.id,
        });

        throw new SecurityError(
          '权限条件未满足',
          'CONDITION_NOT_MET',
          403
        );
      }
    }
  }

  private handleError(
    error: Error,
    request: InterceptedRequest
  ): never {
    const securityError = error instanceof SecurityError
      ? error
      : new SecurityError(
          error.message,
          'INTERNAL_ERROR',
          500
        );

    const severity = securityError.statusCode >= 500 ? 'high' : 'medium';

    this.logSecurityEvent({
      type: securityError.code.includes('UNAUTHORIZED') || securityError.code.includes('PERMISSION')
        ? 'unauthorized_access'
        : 'suspicious_activity',
      severity,
      source: request.path,
      action: 'error',
      details: {
        code: securityError.code,
        message: securityError.message,
        stack: this.config.strictMode ? undefined : error.stack,
      },
      request,
      blocked: true,
      userId: request.user?.id,
      sessionId: request.session?.id,
    });

    for (const handler of this.errorHandlers) {
      const response = handler(securityError, request);
      if (response) {
        return response as never;
      }
    }

    throw securityError;
  }

  private logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date(),
    };

    this.securityEvents.push(fullEvent);

    if (this.securityEvents.length > 10000) {
      this.securityEvents = this.securityEvents.slice(-5000);
    }

    if (this.config.onSecurityEvent) {
      try {
        this.config.onSecurityEvent(fullEvent);
      } catch (error) {
        console.error('Security event callback error:', error);
      }
    }
  }

  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  addErrorHandler(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  removeRequestInterceptor(interceptor: RequestInterceptor): boolean {
    const index = this.requestInterceptors.indexOf(interceptor);
    if (index !== -1) {
      this.requestInterceptors.splice(index, 1);
      return true;
    }
    return false;
  }

  removeResponseInterceptor(interceptor: ResponseInterceptor): boolean {
    const index = this.responseInterceptors.indexOf(interceptor);
    if (index !== -1) {
      this.responseInterceptors.splice(index, 1);
      return true;
    }
    return false;
  }

  removeErrorHandler(handler: ErrorHandler): boolean {
    const index = this.errorHandlers.indexOf(handler);
    if (index !== -1) {
      this.errorHandlers.splice(index, 1);
      return true;
    }
    return false;
  }

  getSecurityEvents(filter?: {
    type?: SecurityEventType;
    severity?: SecurityEvent['severity'];
    startTime?: Date;
    endTime?: Date;
    userId?: string;
    blocked?: boolean;
  }): SecurityEvent[] {
    let events = this.securityEvents;

    if (filter) {
      if (filter.type) {
        events = events.filter(e => e.type === filter.type);
      }
      if (filter.severity) {
        events = events.filter(e => e.severity === filter.severity);
      }
      if (filter.startTime) {
        events = events.filter(e => e.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        events = events.filter(e => e.timestamp <= filter.endTime!);
      }
      if (filter.userId) {
        events = events.filter(e => e.userId === filter.userId);
      }
      if (filter.blocked !== undefined) {
        events = events.filter(e => e.blocked === filter.blocked);
      }
    }

    return events;
  }

  getSecurityStats(): {
    totalEvents: number;
    eventsByType: Record<SecurityEventType, number>;
    eventsBySeverity: Record<SecurityEvent['severity'], number>;
    blockedCount: number;
    recentEvents: SecurityEvent[];
  } {
    const eventsByType: Record<SecurityEventType, number> = {} as Record<SecurityEventType, number>;
    const eventsBySeverity: Record<SecurityEvent['severity'], number> = {} as Record<SecurityEvent['severity'], number>;

    for (const event of this.securityEvents) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
    }

    return {
      totalEvents: this.securityEvents.length,
      eventsByType,
      eventsBySeverity,
      blockedCount: this.securityEvents.filter(e => e.blocked).length,
      recentEvents: this.securityEvents.slice(-10),
    };
  }

  clearSecurityEvents(): void {
    this.securityEvents = [];
  }

  setConfig(config: Partial<InterceptorConfig>): void {
    Object.assign(this.config, config);
  }

  getConfig(): InterceptorConfig {
    return { ...this.config };
  }

  getValidator(): InputValidator {
    return this.validator;
  }

  getPermissionChecker(): PermissionChecker {
    return this.permissionChecker;
  }

  getSanitizer(): Sanitizer {
    return this.sanitizer;
  }

  private generateRequestId(): string {
    this.requestCounter++;
    return `req_${Date.now()}_${this.requestCounter}`;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const defaultInterceptor = new SecurityInterceptor();

export function createSecurityMiddleware(config?: InterceptorConfig) {
  const interceptor = new SecurityInterceptor(config);

  return {
    interceptRequest: interceptor.interceptRequest.bind(interceptor),
    interceptResponse: interceptor.interceptResponse.bind(interceptor),
    checkPermission: interceptor.checkPermission.bind(interceptor),
    getSecurityEvents: interceptor.getSecurityEvents.bind(interceptor),
    getSecurityStats: interceptor.getSecurityStats.bind(interceptor),
  };
}
