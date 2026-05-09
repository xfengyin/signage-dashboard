import type { Plugin, PluginContext, Skill, SkillContext, SkillResult } from '../../src/spi/plugin';

interface TranslationSkill extends Skill {
  id: 'translation';
  capabilities: ['text_translation', 'batch_translation'];
}

interface SummarizationSkill extends Skill {
  id: 'summarization';
  capabilities: ['text_summarization', 'bullet_points'];
}

interface CodeReviewSkill extends Skill {
  id: 'code-review';
  capabilities: ['review', 'suggestions', 'security_scan'];
}

const translationSkill: TranslationSkill = {
  id: 'translation',
  name: 'Translation Skill',
  description: 'Translates text between different languages with context awareness',
  capabilities: ['text_translation', 'batch_translation'],

  async execute(context: SkillContext): Promise<SkillResult> {
    try {
      const { input, options } = context;
      const text = typeof input === 'string' ? input : JSON.stringify(input);
      const targetLang = (options?.targetLang as string) ?? 'en';
      const sourceLang = (options?.sourceLang as string) ?? 'auto';

      const mockTranslations: Record<string, Record<string, string>> = {
        'zh|en': 'This is a translation from Chinese',
        'en|zh': '这是一个中文翻译',
        'ja|en': 'This is a translation from Japanese',
        'ko|en': 'This is a translation from Korean',
      };

      const key = `${sourceLang}|${targetLang}`;
      const translatedText = mockTranslations[key] ?? `[Translated to ${targetLang}] ${text}`;

      return {
        success: true,
        output: {
          original: text,
          translated: translatedText,
          sourceLang,
          targetLang,
        },
        metadata: {
          wordCount: text.split(/\s+/).length,
          translatedAt: new Date().toISOString(),
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Translation failed',
      };
    }
  },
};

const summarizationSkill: SummarizationSkill = {
  id: 'summarization',
  name: 'Summarization Skill',
  description: 'Creates concise summaries of long text content',
  capabilities: ['text_summarization', 'bullet_points'],

  async execute(context: SkillContext): Promise<SkillResult> {
    try {
      const { input, options } = context;
      const text = typeof input === 'string' ? input : JSON.stringify(input);
      const maxLength = (options?.maxLength as number) ?? 200;
      const format = (options?.format as 'paragraph' | 'bullets') ?? 'paragraph';

      const words = text.split(/\s+/);
      let summary: string;

      if (words.length <= maxLength / 5) {
        summary = text;
      } else {
        const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
        const numSentences = Math.min(Math.ceil(words.length / 10), Math.ceil(maxLength / 20));
        summary = sentences.slice(0, numSentences).join(' ').trim();
        
        if (summary.length > maxLength) {
          summary = summary.substring(0, maxLength - 3) + '...';
        }
      }

      if (format === 'bullets') {
        const bulletPoints = summary
          .split(/[,;]/)
          .map((point) => point.trim())
          .filter(Boolean)
          .map((point) => `• ${point.charAt(0).toUpperCase() + point.slice(1)}`);
        
        return {
          success: true,
          output: bulletPoints,
          metadata: {
            format,
            originalLength: text.length,
            summaryLength: summary.length,
            points: bulletPoints.length,
          },
        };
      }

      return {
        success: true,
        output: summary,
        metadata: {
          format,
          originalLength: text.length,
          summaryLength: summary.length,
          compressionRatio: ((1 - summary.length / text.length) * 100).toFixed(1) + '%',
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Summarization failed',
      };
    }
  },
};

const codeReviewSkill: CodeReviewSkill = {
  id: 'code-review',
  name: 'Code Review Skill',
  description: 'Analyzes code for quality, security issues, and improvement suggestions',
  capabilities: ['review', 'suggestions', 'security_scan'],

  async execute(context: SkillContext): Promise<SkillResult> {
    try {
      const { input, options } = context;
      const code = typeof input === 'string' ? input : JSON.stringify(input);
      const scanType = (options?.scanType as string) ?? 'full';

      const issues: Array<{
        severity: 'critical' | 'warning' | 'info';
        line?: number;
        message: string;
        suggestion?: string;
      }> = [];

      if (scanType === 'full' || scanType === 'security') {
        const securityPatterns = [
          { pattern: /password\s*=/gi, message: 'Hardcoded password detected', severity: 'critical' as const },
          { pattern: /api[_-]?key\s*=/gi, message: 'Hardcoded API key detected', severity: 'critical' as const },
          { pattern: /eval\s*\(/g, message: 'Use of eval() is a security risk', severity: 'critical' as const },
          { pattern: /innerHTML\s*=/g, message: 'Potential XSS vulnerability with innerHTML', severity: 'warning' as const },
        ];

        securityPatterns.forEach(({ pattern, message, severity }) => {
          if (pattern.test(code)) {
            const lines = code.substring(0, code.search(pattern)).split('\n');
            issues.push({
              severity,
              line: lines.length,
              message,
              suggestion: 'Use safer alternatives or environment variables',
            });
          }
        });
      }

      if (scanType === 'full' || scanType === 'review') {
        const codePatterns = [
          { pattern: /console\.(log|debug)\s*\(/g, message: 'Debug console statement found', severity: 'info' as const },
          { pattern: /catch\s*\(\s*\w*\s*\)\s*\{\s*\}/g, message: 'Empty catch block', severity: 'warning' as const },
          { pattern: /var\s+\w+/g, message: 'Use of var instead of const/let', severity: 'info' as const },
        ];

        codePatterns.forEach(({ pattern, message, severity }) => {
          if (pattern.test(code)) {
            issues.push({ severity, message });
          }
        });
      }

      const summary = {
        totalIssues: issues.length,
        critical: issues.filter((i) => i.severity === 'critical').length,
        warnings: issues.filter((i) => i.severity === 'warning').length,
        info: issues.filter((i) => i.severity === 'info').length,
        issues,
      };

      return {
        success: true,
        output: summary,
        metadata: {
          scanType,
          linesOfCode: code.split('\n').length,
          scannedAt: new Date().toISOString(),
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Code review failed',
      };
    }
  },
};

export const ExampleSkillPlugin: Plugin = {
  metadata: {
    name: 'example-skill-plugin',
    version: '1.0.0',
    author: 'Agent Framework Team',
    description: 'Example plugin demonstrating Skill interface implementation with translation, summarization, and code review skills',
    dependencies: [],
    entryPoint: './examples/plugins/example-skill-plugin.ts',
  },
  status: 'pending',

  async init(context: PluginContext): Promise<void> {
    console.log(`[ExampleSkillPlugin] Initializing with context: ${context.pluginId}`);
  },

  async load(): Promise<void> {
    console.log('[ExampleSkillPlugin] Loading skills...');
  },

  async unload(): Promise<void> {
    console.log('[ExampleSkillPlugin] Unloading skills...');
  },

  async destroy(): Promise<void> {
    console.log('[ExampleSkillPlugin] Destroying plugin...');
  },

  async onActivate(): Promise<void> {
    console.log('[ExampleSkillPlugin] Activated');
  },

  async onDeactivate(): Promise<void> {
    console.log('[ExampleSkillPlugin] Deactivated');
  },
};

export function getSkills(): Skill[] {
  return [translationSkill, summarizationSkill, codeReviewSkill];
}

export function getSkillById(id: string): Skill | undefined {
  const skills = getSkills();
  return skills.find((s) => s.id === id);
}

export default ExampleSkillPlugin;
