import type { Plugin, PluginContext, Tool, ToolResult, ToolParameter } from '../../src/spi/plugin';

export interface CalculatorTool extends Tool {
  name: 'calculator';
  parameters: {
    expression: ToolParameter;
    precision?: ToolParameter;
  };
}

function evaluateExpression(expression: string): number {
  const sanitized = expression.replace(/[^0-9+\-*/.()% ]/g, '');
  
  const tokens: string[] = [];
  let current = '';
  
  for (const char of sanitized) {
    if ('0123456789.'.includes(char)) {
      current += char;
    } else if ('+-*/%'.includes(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      tokens.push(char);
    }
  }
  if (current) {
    tokens.push(current);
  }

  function parseExpression(): number {
    let result = parseTerm();
    while (tokens.length > 0 && ['+', '-'].includes(tokens[0])) {
      const op = tokens.shift()!;
      const term = parseTerm();
      result = op === '+' ? result + term : result - term;
    }
    return result;
  }

  function parseTerm(): number {
    let result = parseFactor();
    while (tokens.length > 0 && ['*', '/', '%'].includes(tokens[0])) {
      const op = tokens.shift()!;
      const factor = parseFactor();
      if (op === '/') {
        if (factor === 0) throw new Error('Division by zero');
        result = result / factor;
      } else if (op === '*') {
        result = result * factor;
      } else {
        result = result % factor;
      }
    }
    return result;
  }

  function parseFactor(): number {
    const token = tokens.shift();
    if (token === undefined) throw new Error('Unexpected end of expression');
    if (token === '(') {
      const result = parseExpression();
      if (tokens.shift() !== ')') throw new Error('Missing closing parenthesis');
      return result;
    }
    return parseFloat(token);
  }

  if (tokens.length === 0) throw new Error('Empty expression');
  return parseExpression();
}

const calculatorTool: CalculatorTool = {
  name: 'calculator',
  description: 'A safe mathematical calculator tool for evaluating expressions',
  parameters: {
    expression: {
      type: 'string',
      description: 'Mathematical expression to evaluate (supports +, -, *, /, %, parentheses)',
      required: true,
    },
    precision: {
      type: 'number',
      description: 'Number of decimal places to round to (default: 10)',
      required: false,
      default: 10,
    },
  },
  execute(params: Record<string, unknown>): ToolResult {
    try {
      const expression = params.expression as string;
      const precision = (params.precision as number) ?? 10;

      if (!expression || typeof expression !== 'string') {
        return {
          success: false,
          error: 'Expression is required and must be a string',
        };
      }

      const result = evaluateExpression(expression);
      const roundedResult = Number(result.toFixed(precision));

      return {
        success: true,
        data: roundedResult,
        metadata: {
          originalExpression: expression,
          precision,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown calculation error',
      };
    }
  },
};

export interface WeatherTool extends Tool {
  name: 'weather';
  parameters: {
    city: ToolParameter;
    units?: ToolParameter;
  };
}

const weatherTool: WeatherTool = {
  name: 'weather',
  description: 'Get current weather information for a specified city',
  parameters: {
    city: {
      type: 'string',
      description: 'City name to get weather for',
      required: true,
    },
    units: {
      type: 'string',
      description: 'Temperature units: "celsius" or "fahrenheit" (default: celsius)',
      required: false,
      default: 'celsius',
      enum: ['celsius', 'fahrenheit'],
    },
  },
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const city = params.city as string;
      const units = (params.units as string) ?? 'celsius';

      if (!city) {
        return {
          success: false,
          error: 'City name is required',
        };
      }

      const mockWeatherData = {
        city,
        temperature: Math.round(Math.random() * 30) + 5,
        condition: ['Sunny', 'Cloudy', 'Rainy', 'Partly Cloudy'][Math.floor(Math.random() * 4)],
        humidity: Math.round(Math.random() * 50) + 30,
        windSpeed: Math.round(Math.random() * 20),
      };

      if (units === 'fahrenheit') {
        mockWeatherData.temperature = Math.round((mockWeatherData.temperature * 9) / 5 + 32);
      }

      return {
        success: true,
        data: mockWeatherData,
        metadata: { units, fetchedAt: new Date().toISOString() },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch weather',
      };
    }
  },
};

export const ExampleToolPlugin: Plugin = {
  metadata: {
    name: 'example-tool-plugin',
    version: '1.0.0',
    author: 'Agent Framework Team',
    description: 'Example plugin demonstrating Tool interface implementation with calculator and weather tools',
    dependencies: [],
    entryPoint: './examples/plugins/example-tool-plugin.ts',
  },
  status: 'pending',
  tools: [calculatorTool, weatherTool],

  async init(context: PluginContext): Promise<void> {
    console.log(`[ExampleToolPlugin] Initializing with context: ${context.pluginId}`);
  },

  async load(): Promise<void> {
    console.log('[ExampleToolPlugin] Loading tools...');
  },

  async unload(): Promise<void> {
    console.log('[ExampleToolPlugin] Unloading tools...');
  },

  async destroy(): Promise<void> {
    console.log('[ExampleToolPlugin] Destroying plugin...');
  },

  async onActivate(): Promise<void> {
    console.log('[ExampleToolPlugin] Activated');
  },

  async onDeactivate(): Promise<void> {
    console.log('[ExampleToolPlugin] Deactivated');
  },
};

(ExampleToolPlugin as Plugin & { tools?: Tool[] }).tools = [calculatorTool, weatherTool];

export function getTools(): Tool[] {
  return [calculatorTool, weatherTool];
}

export function getToolByName(name: string): Tool | undefined {
  const tools = getTools();
  return tools.find((t) => t.name === name);
}

export default ExampleToolPlugin;
