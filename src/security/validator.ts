export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata?: Record<string, unknown>;
}

export interface ValidationError {
  type: ValidationErrorType;
  field?: string;
  message: string;
  severity: 'error' | 'critical';
  code: string;
  position?: { line: number; column: number };
}

export interface ValidationWarning {
  type: ValidationWarningType;
  field?: string;
  message: string;
  code: string;
}

export type ValidationErrorType =
  | 'prompt_injection'
  | 'sql_injection'
  | 'xss'
  | 'command_injection'
  | 'path_traversal'
  | 'invalid_input'
  | 'rate_limit'
  | 'size_limit';

export type ValidationWarningType =
  | 'suspicious_pattern'
  | 'potential_issue'
  | 'deprecated_usage';

export interface ValidationRule {
  name: string;
  validate: (input: unknown) => ValidationResult;
  enabled?: boolean;
  severity?: 'error' | 'warning';
}

export interface InputValidatorConfig {
  enablePromptInjectionDetection?: boolean;
  enableSqlInjectionDetection?: boolean;
  enableXssDetection?: boolean;
  enableCommandInjectionDetection?: boolean;
  enablePathTraversalDetection?: boolean;
  maxInputLength?: number;
  maxDepth?: number;
  strictMode?: boolean;
  customRules?: ValidationRule[];
}

interface InjectionPattern {
  name: string;
  pattern: RegExp;
  description: string;
  severity: 'error' | 'warning';
}

const PROMPT_INJECTION_PATTERNS: InjectionPattern[] = [
  { name: 'ignore_instructions', pattern: /\b(ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|orders?|rules?|directions?))\b/gi, description: '忽略之前指令', severity: 'error' },
  { name: 'system_override', pattern: /\b(you\s+are\s+(now|just)|pretend\s+to\s+be|act\s+as\s+(if\s+you\s+were|like))\b/gi, description: '角色扮演/系统覆盖', severity: 'warning' },
  { name: 'jailbreak', pattern: /\b(DAN|do\s+anything\s+now|mode\s+unlocked|/jailbreak)\b/gi, description: '越狱指令', severity: 'critical' },
  { name: 'new_instructions', pattern: /\b(new\s+(system\s+)?instructions?|instead\s+of\s+your)\b/gi, description: '新指令注入', severity: 'error' },
  { name: 'forget_instructions', pattern: /\b(forget\s+(all|everything)|disregard\s+your)\b/gi, description: '忘记指令', severity: 'error' },
  { name: 'developer_mode', pattern: /\b(developer|dev\s+mode|\(disabled|\<system|\<human)\b/gi, description: '开发者模式尝试', severity: 'critical' },
  { name: 'leak_prompt', pattern: /\b(show\s+(me\s+)?your|reveal\s+your|what\s+are\s+your)\s+(instructions?|system|prompt)\b/gi, description: '提示词泄露尝试', severity: 'warning' },
  { name: 'context_manipulation', pattern: /\b(previous|above|before)\s+(conversation|context|message|input)\b/gi, description: '上下文操作尝试', severity: 'warning' },
  { name: 'nested_instruction', pattern: /\b(respond\s+(with|using)|output\s+(only|exactly)|format\s+as)\s+/gi, description: '嵌套指令', severity: 'warning' },
  { name: ' privilege_escalation', pattern: /\b(admin|root|supervisor|elevated)\s*(mode|privilege|access)\b/gi, description: '权限提升尝试', severity: 'error' },
];

const SQL_INJECTION_PATTERNS: InjectionPattern[] = [
  { name: 'union_based', pattern: /\b(union\s+(all\s+)?select|union\s+select)\b/gi, description: 'UNION注入', severity: 'error' },
  { name: 'boolean_based', pattern: /\b(and|or)\s+(\d+|\w+)\s*(=|<|>|like)\s*(\d+|\w+)\b/gi, description: '布尔注入', severity: 'error' },
  { name: 'time_based', pattern: /\b(sleep|waitfor|benchmark|pg_sleep|dbms_lock)\s*\(/gi, description: '时间盲注', severity: 'error' },
  { name: 'error_based', pattern: /\b(extractvalue|updatexml|exp|xpath)\s*\(/gi, description: '报错注入', severity: 'error' },
  { name: 'stacked_queries', pattern: /;\s*(select|insert|update|delete|drop|create|alter|exec|execute)\b/gi, description: '堆叠查询', severity: 'critical' },
  { name: 'comment_termination', pattern: /(--|#|\/\*)/gi, description: '注释终止', severity: 'warning' },
  { name: 'or_1_equals', pattern: /\bor\b\s+\d+\s*=\s*\d+/gi, description: 'OR 1=1模式', severity: 'error' },
  { name: 'quoted_strings', pattern: /('\s*(or|and)\s*')/gi, description: '字符串引号注入', severity: 'warning' },
];

const XSS_PATTERNS: InjectionPattern[] = [
  { name: 'script_tag', pattern: /<script[^>]*>.*?<\/script>/gi, description: 'Script标签', severity: 'critical' },
  { name: 'javascript_uri', pattern: /javascript\s*:/gi, description: 'JavaScript协议', severity: 'critical' },
  { name: 'event_handlers', pattern: /\bon\w+\s*=/gi, description: '事件处理器', severity: 'critical' },
  { name: 'data_uri', pattern: /data\s*:\s*text\/html/gi, description: 'Data URI', severity: 'error' },
  { name: 'svg_tag', pattern: /<svg[^>]*>.*?<\/svg>/gi, description: 'SVG标签', severity: 'error' },
  { name: 'iframe_tag', pattern: /<iframe[^>]*>/gi, description: 'Iframe标签', severity: 'error' },
  { name: 'style_injection', pattern: /expression\s*\(/gi, description: 'CSS表达式', severity: 'error' },
  { name: 'base64_decode', pattern: /atob\s*\(|decodeURIComponent\s*\(/gi, description: '解码函数滥用', severity: 'warning' },
  { name: 'dom_manipulation', pattern: /(innerHTML|outerHTML|insertAdjacentHTML|document\.write)\s*\(/gi, description: 'DOM操作', severity: 'warning' },
  { name: 'xml_parsing', pattern: /<xml[^>]*>.*?<\/xml>/gi, description: 'XML解析', severity: 'warning' },
];

const COMMAND_INJECTION_PATTERNS: InjectionPattern[] = [
  { name: 'shell_metachar', pattern: /[;&|`$(){}[\]\\!<>]/g, description: 'Shell元字符', severity: 'error' },
  { name: 'command_separators', pattern: /\b(;|&&|\|\||\|)\s*\w+/g, description: '命令分隔符', severity: 'error' },
  { name: 'pipe_to_shell', pattern: /\|\s*(sh|bash|cmd|powershell|perl|python|ruby)\b/gi, description: '管道到Shell', severity: 'critical' },
  { name: 'command_substitution', pattern: /\$\([^)]+\)|`[^`]+`/g, description: '命令替换', severity: 'error' },
  { name: 'dangerous_commands', pattern: /\b(rm\s+-rf|del\s+\/|format\s+|mkfs|dd\s+if)\b/gi, description: '危险命令', severity: 'critical' },
  { name: 'path_traversal', pattern: /\.\.\/|\.\.\\\/gi, description: '路径遍历', severity: 'error' },
  { name: 'env_variable', pattern: /\$\{?\w+\}?/g, description: '环境变量', severity: 'warning' },
  { name: 'download_exec', pattern: /\b(wget|curl).*\|\s*(sh|bash|perl|python)\b/gi, description: '下载并执行', severity: 'critical' },
  { name: 'reverse_shell', pattern: /\b(nc\s+-e|bash\s+-i|python\s+-c\s+.*socket)\b/gi, description: '反向Shell', severity: 'critical' },
];

const PATH_TRAVERSAL_PATTERNS: InjectionPattern[] = [
  { name: 'dotdot_slash', pattern: /\.\.\/+/g, description: '../路径遍历', severity: 'error' },
  { name: 'dotdot_backslash', pattern: /\.\.\\+/g, description: '..\\路径遍历', severity: 'error' },
  { name: 'null_byte', pattern: /%00/g, description: '空字节注入', severity: 'critical' },
  { name: 'double_encoding', pattern: /%252e%252e/i, description: '双重编码', severity: 'error' },
  { name: 'absolute_path', pattern: /^\/(etc|var|usr|proc|sys|root)/i, description: '绝对路径', severity: 'warning' },
  { name: 'url_encoding', pattern: /%2e%2e|%2f/i, description: 'URL编码遍历', severity: 'error' },
];

export class InputValidator {
  private config: Required<InputValidatorConfig>;
  private customRules: ValidationRule[];
  private validationHistory: Map<string, ValidationResult>;

  constructor(config: InputValidatorConfig = {}) {
    this.config = {
      enablePromptInjectionDetection: config.enablePromptInjectionDetection ?? true,
      enableSqlInjectionDetection: config.enableSqlInjectionDetection ?? true,
      enableXssDetection: config.enableXssDetection ?? true,
      enableCommandInjectionDetection: config.enableCommandInjectionDetection ?? true,
      enablePathTraversalDetection: config.enablePathTraversalDetection ?? true,
      maxInputLength: config.maxInputLength ?? 100000,
      maxDepth: config.maxDepth ?? 10,
      strictMode: config.strictMode ?? true,
      customRules: config.customRules ?? [],
    };
    this.customRules = [...this.config.customRules];
    this.validationHistory = new Map();
  }

  validate(input: unknown, context?: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const metadata: Record<string, unknown> = {};

    if (typeof input === 'string') {
      const stringResult = this.validateString(input, context);
      errors.push(...stringResult.errors);
      warnings.push(...stringResult.warnings);
      Object.assign(metadata, stringResult.metadata);
    } else if (typeof input === 'object' && input !== null) {
      const objectResult = this.validateObject(input as Record<string, unknown>, 0);
      errors.push(...objectResult.errors);
      warnings.push(...objectResult.warnings);
    }

    for (const rule of this.customRules) {
      if (rule.enabled !== false) {
        const result = rule.validate(input);
        if (!result.valid) {
          errors.push(...result.errors);
        }
        warnings.push(...result.warnings);
      }
    }

    const result: ValidationResult = {
      valid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
      warnings,
      metadata,
    };

    if (context) {
      this.validationHistory.set(context, result);
    }

    return result;
  }

  private validateString(input: string, context?: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const metadata: Record<string, unknown> = {};

    if (input.length > this.config.maxInputLength) {
      errors.push({
        type: 'size_limit',
        message: `输入长度超过限制: ${input.length} > ${this.config.maxInputLength}`,
        severity: 'error',
        code: 'SIZE_LIMIT_EXCEEDED',
      });
    }

    if (this.config.enablePromptInjectionDetection) {
      const promptResult = this.detectPromptInjection(input);
      errors.push(...promptResult.errors);
      warnings.push(...promptResult.warnings);
      metadata.promptInjectionScore = promptResult.score;
    }

    if (this.config.enableSqlInjectionDetection) {
      const sqlResult = this.detectSqlInjection(input);
      errors.push(...sqlResult.errors);
      warnings.push(...sqlResult.warnings);
      metadata.sqlInjectionScore = sqlResult.score;
    }

    if (this.config.enableXssDetection) {
      const xssResult = this.detectXss(input);
      errors.push(...xssResult.errors);
      warnings.push(...xssResult.warnings);
      metadata.xssScore = xssResult.score;
    }

    if (this.config.enableCommandInjectionDetection) {
      const cmdResult = this.detectCommandInjection(input);
      errors.push(...cmdResult.errors);
      warnings.push(...cmdResult.warnings);
      metadata.commandInjectionScore = cmdResult.score;
    }

    if (this.config.enablePathTraversalDetection) {
      const pathResult = this.detectPathTraversal(input);
      errors.push(...pathResult.errors);
      warnings.push(...pathResult.warnings);
      metadata.pathTraversalScore = pathResult.score;
    }

    return { valid: true, errors, warnings, metadata };
  }

  private validateObject(obj: Record<string, unknown>, depth: number): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (depth > this.config.maxDepth) {
      errors.push({
        type: 'invalid_input',
        message: `对象嵌套深度超过限制: ${depth} > ${this.config.maxDepth}`,
        severity: 'error',
        code: 'MAX_DEPTH_EXCEEDED',
      });
      return { valid: false, errors, warnings };
    }

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        const result = this.validateString(value, key);
        errors.push(...result.errors.map(e => ({ ...e, field: key })));
        warnings.push(...result.warnings.map(w => ({ ...w, field: key })));
      } else if (typeof value === 'object' && value !== null) {
        const nestedResult = this.validateObject(value as Record<string, unknown>, depth + 1);
        errors.push(...nestedResult.errors);
        warnings.push(...nestedResult.warnings);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private detectPromptInjection(input: string): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
    score: number;
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let score = 0;
    const matchedPatterns: string[] = [];

    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      const matches = input.match(pattern.pattern);
      if (matches) {
        matchedPatterns.push(pattern.name);
        if (pattern.severity === 'critical') {
          score += 3;
          errors.push({
            type: 'prompt_injection',
            message: `检测到提示词注入: ${pattern.description}`,
            severity: pattern.severity,
            code: `PROMPT_INJECTION_${pattern.name.toUpperCase()}`,
          });
        } else if (pattern.severity === 'error') {
          score += 2;
          errors.push({
            type: 'prompt_injection',
            message: `检测到提示词注入: ${pattern.description}`,
            severity: pattern.severity,
            code: `PROMPT_INJECTION_${pattern.name.toUpperCase()}`,
          });
        } else {
          score += 1;
          warnings.push({
            type: 'suspicious_pattern',
            message: `可疑模式: ${pattern.description}`,
            code: `SUSPICIOUS_${pattern.name.toUpperCase()}`,
          });
        }
      }
    }

    if (score >= 3) {
      errors.push({
        type: 'prompt_injection',
        message: '提示词注入风险等级: 高',
        severity: 'critical',
        code: 'HIGH_RISK_PROMPT_INJECTION',
      });
    }

    return { errors, warnings, score };
  }

  private detectSqlInjection(input: string): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
    score: number;
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let score = 0;

    for (const pattern of SQL_INJECTION_PATTERNS) {
      const matches = input.match(pattern.pattern);
      if (matches) {
        if (pattern.severity === 'critical') {
          score += 3;
          errors.push({
            type: 'sql_injection',
            message: `检测到SQL注入风险: ${pattern.description}`,
            severity: pattern.severity,
            code: `SQL_INJECTION_${pattern.name.toUpperCase()}`,
          });
        } else {
          score += 2;
          errors.push({
            type: 'sql_injection',
            message: `检测到SQL注入风险: ${pattern.description}`,
            severity: pattern.severity,
            code: `SQL_INJECTION_${pattern.name.toUpperCase()}`,
          });
        }
      }
    }

    return { errors, warnings, score };
  }

  private detectXss(input: string): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
    score: number;
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let score = 0;

    for (const pattern of XSS_PATTERNS) {
      const matches = input.match(pattern.pattern);
      if (matches) {
        if (pattern.severity === 'critical') {
          score += 3;
          errors.push({
            type: 'xss',
            message: `检测到XSS风险: ${pattern.description}`,
            severity: pattern.severity,
            code: `XSS_${pattern.name.toUpperCase()}`,
          });
        } else {
          score += 2;
          errors.push({
            type: 'xss',
            message: `检测到XSS风险: ${pattern.description}`,
            severity: pattern.severity,
            code: `XSS_${pattern.name.toUpperCase()}`,
          });
        }
      }
    }

    return { errors, warnings, score };
  }

  private detectCommandInjection(input: string): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
    score: number;
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let score = 0;

    for (const pattern of COMMAND_INJECTION_PATTERNS) {
      const matches = input.match(pattern.pattern);
      if (matches) {
        if (pattern.severity === 'critical') {
          score += 3;
          errors.push({
            type: 'command_injection',
            message: `检测到命令注入风险: ${pattern.description}`,
            severity: pattern.severity,
            code: `CMD_INJECTION_${pattern.name.toUpperCase()}`,
          });
        } else {
          score += 2;
          errors.push({
            type: 'command_injection',
            message: `检测到命令注入风险: ${pattern.description}`,
            severity: pattern.severity,
            code: `CMD_INJECTION_${pattern.name.toUpperCase()}`,
          });
        }
      }
    }

    return { errors, warnings, score };
  }

  private detectPathTraversal(input: string): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
    score: number;
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let score = 0;

    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
      const matches = input.match(pattern.pattern);
      if (matches) {
        if (pattern.severity === 'critical') {
          score += 3;
          errors.push({
            type: 'path_traversal',
            message: `检测到路径遍历: ${pattern.description}`,
            severity: pattern.severity,
            code: `PATH_TRAVERSAL_${pattern.name.toUpperCase()}`,
          });
        } else {
          score += 2;
          errors.push({
            type: 'path_traversal',
            message: `检测到路径遍历: ${pattern.description}`,
            severity: pattern.severity,
            code: `PATH_TRAVERSAL_${pattern.name.toUpperCase()}`,
          });
        }
      }
    }

    return { errors, warnings, score };
  }

  validateFilePath(path: string, allowedDirs?: string[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const pathResult = this.detectPathTraversal(path);
    errors.push(...pathResult.errors);
    warnings.push(...pathResult.warnings);

    if (allowedDirs && allowedDirs.length > 0) {
      const normalizedPath = path.replace(/\\/g, '/').replace(/\.\.\//g, '');
      const isAllowed = allowedDirs.some(dir => normalizedPath.startsWith(dir.replace(/\\/g, '/')));
      if (!isAllowed) {
        errors.push({
          type: 'path_traversal',
          message: '文件路径不在允许的目录范围内',
          severity: 'error',
          code: 'PATH_NOT_ALLOWED',
        });
      }
    }

    const dangerousExtensions = ['.exe', '.sh', '.bat', '.cmd', '.ps1', '.vbs', '.js', '.jar'];
    const ext = path.toLowerCase().slice(path.lastIndexOf('.'));
    if (dangerousExtensions.includes(ext)) {
      warnings.push({
        type: 'potential_issue',
        message: `检测到潜在危险的文件扩展名: ${ext}`,
        code: 'DANGEROUS_EXTENSION',
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  addCustomRule(rule: ValidationRule): void {
    this.customRules.push(rule);
  }

  removeCustomRule(name: string): boolean {
    const index = this.customRules.findIndex(r => r.name === name);
    if (index !== -1) {
      this.customRules.splice(index, 1);
      return true;
    }
    return false;
  }

  setConfig(config: Partial<InputValidatorConfig>): void {
    Object.assign(this.config, config);
  }

  getConfig(): InputValidatorConfig {
    return { ...this.config };
  }

  getValidationHistory(context?: string): Map<string, ValidationResult> | ValidationResult | undefined {
    if (context) {
      return this.validationHistory.get(context);
    }
    return this.validationHistory;
  }

  clearHistory(): void {
    this.validationHistory.clear();
  }
}

export const defaultValidator = new InputValidator();

export function validate(
  input: unknown,
  context?: string,
  config?: InputValidatorConfig
): ValidationResult {
  const validator = new InputValidator(config);
  return validator.validate(input, context);
}

export function validatePrompt(prompt: string): ValidationResult {
  return defaultValidator.validate(prompt, 'prompt');
}
