import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PluginRegistry,
  PluginStrategy,
  Plugin,
  PluginConfig,
  createPluginRegistry,
} from '../../src/spi/registry';

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = createPluginRegistry();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register plugin', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
      };

      registry.register('test-plugin', plugin);

      expect(registry.has('test-plugin')).toBe(true);
    });

    it('should register with config', () => {
      const plugin: Plugin = { name: 'test', version: '1.0.0' };
      const config: PluginConfig = {
        enabled: true,
        priority: 10,
        options: { key: 'value' },
      };

      registry.register('test', plugin, config);

      const pluginConfig = registry.getConfig('test');
      expect(pluginConfig?.enabled).toBe(true);
      expect(pluginConfig?.priority).toBe(10);
    });
  });

  describe('unregister', () => {
    it('should unregister plugin', () => {
      registry.register('test', { name: 'test', version: '1.0.0' });
      registry.unregister('test');

      expect(registry.has('test')).toBe(false);
    });

    it('should return false for missing plugin', () => {
      expect(registry.unregister('missing')).toBe(false);
    });
  });

  describe('get', () => {
    it('should get registered plugin', () => {
      const plugin: Plugin = { name: 'test', version: '1.0.0' };
      registry.register('test', plugin);

      const retrieved = registry.get('test');

      expect(retrieved).toBe(plugin);
    });

    it('should return undefined for missing plugin', () => {
      expect(registry.get('missing')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for registered plugin', () => {
      registry.register('test', { name: 'test', version: '1.0.0' });

      expect(registry.has('test')).toBe(true);
    });

    it('should return false for unregistered plugin', () => {
      expect(registry.has('missing')).toBe(false);
    });
  });

  describe('enable/disable', () => {
    it('should enable plugin', () => {
      registry.register('test', { name: 'test', version: '1.0.0' }, { enabled: false });
      registry.enable('test');

      const config = registry.getConfig('test');
      expect(config?.enabled).toBe(true);
    });

    it('should disable plugin', () => {
      registry.register('test', { name: 'test', version: '1.0.0' });
      registry.disable('test');

      const config = registry.getConfig('test');
      expect(config?.enabled).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return all plugins', () => {
      registry.register('plugin1', { name: 'plugin1', version: '1.0.0' });
      registry.register('plugin2', { name: 'plugin2', version: '1.0.0' });

      const plugins = registry.getAll();

      expect(plugins.size).toBe(2);
    });

    it('should return only enabled plugins', () => {
      registry.register('enabled', { name: 'enabled', version: '1.0.0' }, { enabled: true });
      registry.register('disabled', { name: 'disabled', version: '1.0.0' }, { enabled: false });

      const plugins = registry.getAll(true);

      expect(plugins.size).toBe(1);
      expect(plugins.has('enabled')).toBe(true);
    });
  });

  describe('getByStrategy', () => {
    it('should return plugins with specific strategy', () => {
      registry.register('a', { name: 'a', version: '1.0.0' }, { strategy: 'eager' });
      registry.register('b', { name: 'b', version: '1.0.0' }, { strategy: 'lazy' });

      const lazyPlugins = registry.getByStrategy('lazy');

      expect(lazyPlugins).toHaveLength(1);
      expect(lazyPlugins[0].name).toBe('b');
    });
  });

  describe('updateConfig', () => {
    it('should update plugin config', () => {
      registry.register('test', { name: 'test', version: '1.0.0' });
      registry.updateConfig('test', { priority: 100 });

      const config = registry.getConfig('test');
      expect(config?.priority).toBe(100);
    });
  });

  describe('clear', () => {
    it('should clear all plugins', () => {
      registry.register('plugin1', { name: 'plugin1', version: '1.0.0' });
      registry.register('plugin2', { name: 'plugin2', version: '1.0.0' });
      registry.clear();

      expect(registry.getAll().size).toBe(0);
    });
  });
});

describe('createPluginRegistry', () => {
  it('should create a new registry', () => {
    const registry = createPluginRegistry();

    expect(registry).toBeInstanceOf(PluginRegistry);
  });
});
