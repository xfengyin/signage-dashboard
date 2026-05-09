import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PluginLoader,
  PluginRegistry,
  createPluginLoader,
  createPluginRegistry,
  Plugin,
  PluginMetadata,
} from '../../src/spi/loader';

describe('PluginLoader', () => {
  let loader: PluginLoader;

  beforeEach(() => {
    loader = createPluginLoader();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('load', () => {
    it('should load plugin from file path', async () => {
      const mockPlugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
      };

      vi.mock('../examples/plugins/example-tool-plugin', () => ({
        default: mockPlugin,
      }), { virtual: true });

      const plugin = await loader.load('/path/to/plugin.js');

      expect(plugin).toBeDefined();
    });

    it('should throw error for invalid plugin', async () => {
      await expect(loader.load('/invalid/path')).rejects.toThrow();
    });
  });

  describe('loadFromDirectory', () => {
    it('should load all plugins from directory', async () => {
      const plugins = await loader.loadFromDirectory('/path/to/plugins');

      expect(Array.isArray(plugins)).toBe(true);
    });
  });

  describe('register', () => {
    it('should register plugin', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
      };

      loader.register(plugin);

      expect(loader.get('test-plugin')).toBe(plugin);
    });

    it('should not register duplicate plugins', () => {
      const plugin1: Plugin = { name: 'test', version: '1.0.0' };
      const plugin2: Plugin = { name: 'test', version: '2.0.0' };

      loader.register(plugin1);
      loader.register(plugin2);

      expect(loader.getAll().filter(p => p.name === 'test')).toHaveLength(1);
    });
  });

  describe('get', () => {
    it('should get plugin by name', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
      };

      loader.register(plugin);

      expect(loader.get('test-plugin')).toBe(plugin);
    });

    it('should return undefined for missing plugin', () => {
      expect(loader.get('missing')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all registered plugins', () => {
      loader.register({ name: 'plugin1', version: '1.0.0' });
      loader.register({ name: 'plugin2', version: '1.0.0' });

      const plugins = loader.getAll();

      expect(plugins).toHaveLength(2);
    });
  });

  describe('unregister', () => {
    it('should unregister plugin by name', () => {
      loader.register({ name: 'test', version: '1.0.0' });
      loader.unregister('test');

      expect(loader.get('test')).toBeUndefined();
    });

    it('should return false for missing plugin', () => {
      expect(loader.unregister('missing')).toBe(false);
    });
  });

  describe('has', () => {
    it('should return true for registered plugin', () => {
      loader.register({ name: 'test', version: '1.0.0' });

      expect(loader.has('test')).toBe(true);
    });

    it('should return false for unregistered plugin', () => {
      expect(loader.has('missing')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all plugins', () => {
      loader.register({ name: 'plugin1', version: '1.0.0' });
      loader.register({ name: 'plugin2', version: '1.0.0' });
      loader.clear();

      expect(loader.getAll()).toHaveLength(0);
    });
  });
});

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = createPluginRegistry();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register plugin with metadata', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
      };
      const metadata: PluginMetadata = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test plugin',
        dependencies: [],
      };

      registry.register(plugin, metadata);

      expect(registry.has('test-plugin')).toBe(true);
    });
  });

  describe('getMetadata', () => {
    it('should return plugin metadata', () => {
      const plugin: Plugin = { name: 'test', version: '1.0.0' };
      const metadata: PluginMetadata = {
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        dependencies: [],
      };

      registry.register(plugin, metadata);

      const retrieved = registry.getMetadata('test');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test');
    });

    it('should return undefined for missing plugin', () => {
      const metadata = registry.getMetadata('missing');

      expect(metadata).toBeUndefined();
    });
  });

  describe('getDependencies', () => {
    it('should return plugin dependencies', () => {
      const plugin: Plugin = { name: 'test', version: '1.0.0' };
      const metadata: PluginMetadata = {
        name: 'test',
        version: '1.0.0',
        dependencies: ['dep1', 'dep2'],
      };

      registry.register(plugin, metadata);

      const deps = registry.getDependencies('test');

      expect(deps).toEqual(['dep1', 'dep2']);
    });
  });

  describe('topologicalSort', () => {
    it('should sort plugins by dependencies', () => {
      registry.register(
        { name: 'a', version: '1.0.0' },
        { name: 'a', version: '1.0.0', dependencies: ['b'] }
      );
      registry.register(
        { name: 'b', version: '1.0.0' },
        { name: 'b', version: '1.0.0', dependencies: [] }
      );

      const sorted = registry.topologicalSort();

      expect(sorted.indexOf('b')).toBeLessThan(sorted.indexOf('a'));
    });

    it('should handle circular dependencies', () => {
      registry.register(
        { name: 'a', version: '1.0.0' },
        { name: 'a', version: '1.0.0', dependencies: ['b'] }
      );
      registry.register(
        { name: 'b', version: '1.0.0' },
        { name: 'b', version: '1.0.0', dependencies: ['a'] }
      );

      expect(() => registry.topologicalSort()).toThrow();
    });
  });

  describe('validateDependencies', () => {
    it('should validate all dependencies exist', () => {
      registry.register({ name: 'a', version: '1.0.0' }, { name: 'a', version: '1.0.0', dependencies: [] });

      const result = registry.validateDependencies();

      expect(result.valid).toBe(true);
    });

    it('should return missing dependencies', () => {
      registry.register(
        { name: 'a', version: '1.0.0' },
        { name: 'a', version: '1.0.0', dependencies: ['missing'] }
      );

      const result = registry.validateDependencies();

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('missing');
    });
  });

  describe('getByTag', () => {
    it('should return plugins with specific tag', () => {
      const metadata1: PluginMetadata = {
        name: 'a',
        version: '1.0.0',
        tags: ['auth', 'security'],
      };
      const metadata2: PluginMetadata = {
        name: 'b',
        version: '1.0.0',
        tags: ['database'],
      };

      registry.register({ name: 'a', version: '1.0.0' }, metadata1);
      registry.register({ name: 'b', version: '1.0.0' }, metadata2);

      const authPlugins = registry.getByTag('auth');

      expect(authPlugins).toHaveLength(1);
      expect(authPlugins[0].name).toBe('a');
    });
  });
});

describe('createPluginLoader', () => {
  it('should create a new plugin loader', () => {
    const loader = createPluginLoader();

    expect(loader).toBeInstanceOf(PluginLoader);
  });
});

describe('createPluginRegistry', () => {
  it('should create a new plugin registry', () => {
    const registry = createPluginRegistry();

    expect(registry).toBeInstanceOf(PluginRegistry);
  });
});
