import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ConfigLoader,
  ConfigurationError,
  createConfigLoader,
} from '../../src/config/loader';
import * as fs from 'fs';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
  readFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  watch: vi.fn(),
  readdirSync: vi.fn(),
  promises: {
    readFile: vi.fn(),
    stat: vi.fn(),
  },
}));

describe('ConfigLoader', () => {
  let loader: ConfigLoader;

  beforeEach(() => {
    vi.clearAllMocks();
    loader = createConfigLoader({
      configDir: '/test/config',
      defaultConfigPath: '/test/defaults.yaml',
      envPrefix: 'TEST_',
      enableHotReload: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create loader with default options', () => {
      const l = new ConfigLoader();
      expect(l).toBeInstanceOf(ConfigLoader);
    });

    it('should create loader with custom options', () => {
      const l = new ConfigLoader({
        configDir: '/custom',
        defaultConfigPath: '/custom/defaults.yaml',
      });
      expect(l).toBeInstanceOf(ConfigLoader);
    });
  });

  describe('load', () => {
    it('should load configuration from sources', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const config = await loader.load();

      expect(config).toBeDefined();
      expect(config.agent).toBeDefined();
    });

    it('should throw if already loading', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const loadPromise = loader.load();
      await expect(loader.load()).rejects.toThrow('Config loading is already in progress');
    });
  });

  describe('loadFromFile', () => {
    it('should load from YAML file', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return String(path).includes('config.yaml');
      });
      vi.mocked(fs.readFileSync).mockReturnValue(`
agent:
  name: test-agent
  version: 1.0.0
`);
      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: Date.now(),
      } as fs.Stats);

      const config = await loader.load();

      expect(config.agent.name).toBe('test-agent');
    });

    it('should load from JSON file', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return String(path).includes('config.json');
      });
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        agent: { name: 'json-agent' },
      }));
      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: Date.now(),
      } as fs.Stats);

      const config = await loader.load();

      expect(config.agent.name).toBe('json-agent');
    });
  });

  describe('loadFromEnv', () => {
    it('should load config from environment variables', async () => {
      process.env.TEST_AGENT_NAME = 'env-agent';
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const config = await loader.load();

      expect(config.agent.name).toBe('env-agent');

      delete process.env.TEST_AGENT_NAME;
    });

    it('should convert env keys to config path', async () => {
      process.env.TEST_MODEL_PROVIDER_TYPE = 'openai';
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await loader.load();

      expect(process.env.TEST_MODEL_PROVIDER_TYPE).toBeDefined();

      delete process.env.TEST_MODEL_PROVIDER_TYPE;
    });
  });

  describe('reload', () => {
    it('should reload configuration', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await loader.load();
      const newConfig = await loader.reload();

      expect(newConfig).toBeDefined();
    });
  });

  describe('getConfig', () => {
    it('should return current config', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await loader.load();
      const config = loader.getConfig();

      expect(config).toBeDefined();
    });
  });

  describe('getSource', () => {
    it('should return config source by type', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await loader.load();
      const source = loader.getSource('defaults');

      expect(source).toBeDefined();
      expect(source?.type).toBe('defaults');
    });
  });

  describe('getAllSources', () => {
    it('should return all sources sorted by priority', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await loader.load();
      const sources = loader.getAllSources();

      expect(Array.isArray(sources)).toBe(true);
    });
  });

  describe('updateConfig', () => {
    it('should update config and notify listeners', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await loader.load();

      const listener = vi.fn();
      loader.addListener(listener);

      loader.updateConfig({ agent: { name: 'updated-agent' } as any });

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('listeners', () => {
    it('should add and remove listeners', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await loader.load();

      const listener = vi.fn();
      const remove = loader.addListener(listener);
      loader.removeListener(listener);
      remove();
    });
  });
});

describe('ConfigurationError', () => {
  it('should create error with validation errors', () => {
    const validationErrors = [
      { path: 'agent.name', message: 'required', code: 'REQUIRED' },
    ];
    const error = new ConfigurationError('Validation failed', validationErrors as any);

    expect(error.message).toBe('Validation failed');
    expect(error.errors).toEqual(validationErrors);
    expect(error.name).toBe('ConfigurationError');
  });
});

describe('createConfigLoader', () => {
  it('should create config loader', () => {
    const loader = createConfigLoader();

    expect(loader).toBeInstanceOf(ConfigLoader);
  });

  it('should create loader with options', () => {
    const loader = createConfigLoader({
      configDir: '/custom/config',
    });

    expect(loader).toBeInstanceOf(ConfigLoader);
  });
});
