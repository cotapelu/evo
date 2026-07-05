import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCapabilityRegistry,
  resetCapabilityRegistry,
  createRegistry,
} from '../../extensions/capability-system/registry.js';
import type { Capability } from '../../extensions/capability-system/types.js';

// Helper to create a mock capability
function mockCapability(overrides: Partial<Capability> = {}): Capability {
  return {
    id: 'test-capability',
    name: 'Test Capability',
    description: 'A test capability',
    pluginId: 'test-plugin',
    tags: ['test'],
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input value' },
        count: { type: 'number', description: 'Count' },
      },
      required: ['input'],
    },
    promptGuidelines: ['Use this tool carefully'],
    ...overrides,
  };
}

describe('CapabilityRegistry', () => {
  describe('register / unregister', () => {
    it('should register a new capability', () => {
      const registry = createRegistry();
      const cap = mockCapability();

      registry.register(cap);

      expect(registry.has(cap.id)).toBe(true);
      expect(registry.get(cap.id)).toBe(cap);
    });

    it('should throw on duplicate registration', () => {
      const registry = createRegistry();
      const cap = mockCapability();

      registry.register(cap);
      expect(() => registry.register(cap)).toThrow(`Capability '${cap.id}' is already registered`);
    });

    it('should unregister and return true', () => {
      const registry = createRegistry();
      const cap = mockCapability();
      registry.register(cap);

      const result = registry.unregister(cap.id);

      expect(result).toBe(true);
      expect(registry.has(cap.id)).toBe(false);
    });

    it('should return false when unregistering non-existent capability', () => {
      const registry = createRegistry();

      const result = registry.unregister('non-existent');

      expect(result).toBe(false);
    });

    it('should cleanup plugin capabilities map on unregister', () => {
      const registry = createRegistry();
      const cap1 = mockCapability({ id: 'cap1', pluginId: 'plugin1' });
      const cap2 = mockCapability({ id: 'cap2', pluginId: 'plugin1' });
      registry.register(cap1);
      registry.register(cap2);

      registry.unregister(cap1.id);

      expect(registry.listByPlugin('plugin1')).toHaveLength(1);
      expect(registry.listByPlugin('plugin1')).toContain(cap2);

      registry.unregister(cap2.id);
      expect(registry.listByPlugin('plugin1')).toHaveLength(0);
      // plugin entry should be removed
      const stats = registry.getStats();
      expect(stats.byPlugin['plugin1']).toBeUndefined();
    });
  });

  describe('lookup', () => {
    it('should get capability by id', () => {
      const registry = createRegistry();
      const cap = mockCapability();
      registry.register(cap);

      expect(registry.get(cap.id)).toBe(cap);
      expect(registry.get('unknown')).toBeUndefined();
    });

    it('should check existence with has', () => {
      const registry = createRegistry();
      const cap = mockCapability();
      registry.register(cap);

      expect(registry.has(cap.id)).toBe(true);
      expect(registry.has('unknown')).toBe(false);
    });
  });

  describe('listing', () => {
    it('should list all capabilities', () => {
      const registry = createRegistry();
      const cap1 = mockCapability({ id: 'cap1' });
      const cap2 = mockCapability({ id: 'cap2' });
      registry.register(cap1);
      registry.register(cap2);

      const all = registry.listAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(cap1);
      expect(all).toContain(cap2);
    });

    it('should list by plugin', () => {
      const registry = createRegistry();
      const cap1 = mockCapability({ id: 'cap1', pluginId: 'plugin1' });
      const cap2 = mockCapability({ id: 'cap2', pluginId: 'plugin2' });
      const cap3 = mockCapability({ id: 'cap3', pluginId: 'plugin1' });
      registry.register(cap1);
      registry.register(cap2);
      registry.register(cap3);

      expect(registry.listByPlugin('plugin1')).toHaveLength(2);
      expect(registry.listByPlugin('plugin2')).toHaveLength(1);
      expect(registry.listByPlugin('unknown')).toHaveLength(0);
    });

    it('should list by tag', () => {
      const registry = createRegistry();
      const cap1 = mockCapability({ id: 'cap1', tags: ['tag1', 'common'] });
      const cap2 = mockCapability({ id: 'cap2', tags: ['tag2', 'common'] });
      const cap3 = mockCapability({ id: 'cap3', tags: ['tag3'] });
      registry.register(cap1);
      registry.register(cap2);
      registry.register(cap3);

      expect(registry.listByTag('common')).toHaveLength(2);
      expect(registry.listByTag('tag1')).toHaveLength(1);
      expect(registry.listByTag('non-existent')).toHaveLength(0);
    });

    it('should return all capability ids', () => {
      const registry = createRegistry();
      registry.register(mockCapability({ id: 'cap1' }));
      registry.register(mockCapability({ id: 'cap2' }));
      registry.register(mockCapability({ id: 'cap3' }));

      const ids = registry.getCapabilityIds();
      expect(ids).toContain('cap1');
      expect(ids).toContain('cap2');
      expect(ids).toContain('cap3');
      expect(ids).toHaveLength(3);
    });
  });

  describe('search', () => {
    it('should search by name', () => {
      const registry = createRegistry();
      registry.register(mockCapability({ id: 'cap1', name: 'Search Tool' }));
      registry.register(mockCapability({ id: 'cap2', name: 'Other Tool' }));

      const results = registry.search('Search');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('cap1');
    });

    it('should search by description', () => {
      const registry = createRegistry();
      registry.register(mockCapability({ id: 'cap1', description: 'Does something awesome' }));
      registry.register(mockCapability({ id: 'cap2', description: 'Does something boring' }));

      const results = registry.search('awesome');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('cap1');
    });

    it('should search by id', () => {
      const registry = createRegistry();
      registry.register(mockCapability({ id: 'unique-id' }));

      const results = registry.search('unique');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('unique-id');
    });

    it('should search by tags', () => {
      const registry = createRegistry();
      registry.register(mockCapability({ id: 'cap1', tags: ['searchme'] }));
      registry.register(mockCapability({ id: 'cap2', tags: ['other'] }));

      const results = registry.search('searchme');
      expect(results).toHaveLength(1);
    });

    it('should be case-insensitive', () => {
      const registry = createRegistry();
      registry.register(mockCapability({ id: 'cap1', name: 'UPPERCASE' }));

      expect(registry.search('uppercase')).toHaveLength(1);
      expect(registry.search('LowerCase')).toHaveLength(0);
    });

    it('should return empty array when no match', () => {
      const registry = createRegistry();
      registry.register(mockCapability({ id: 'cap1', name: 'Tool' }));

      expect(registry.search('nonexistent')).toHaveLength(0);
    });
  });

  describe('getSystemPromptSection', () => {
    it('should return empty string when no capabilities', () => {
      const registry = createRegistry();

      const section = registry.getSystemPromptSection();

      expect(section).toBe('');
    });

    it('should generate prompt section for single capability', () => {
      const registry = createRegistry();
      const cap = mockCapability({
        name: 'Read File',
        description: 'Reads a file from disk',
        promptGuidelines: ['Always check file existence first'],
      });
      registry.register(cap);

      const section = registry.getSystemPromptSection();

      expect(section).toContain('## Available Capabilities');
      expect(section).toContain('### Read File');
      expect(section).toContain(`ID: \`${cap.id}\``);
      expect(section).toContain('Reads a file from disk');
      expect(section).toContain('- Always check file existence first');
      expect(section).toContain('**Parameters:**');
    });

    it('should summarize parameters correctly', () => {
      const registry = createRegistry();
      const cap = mockCapability({
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            encoding: { type: 'string', default: 'utf8' },
          },
          required: ['path'],
        },
      });
      registry.register(cap);

      const section = registry.getSystemPromptSection();

      expect(section).toContain('path: string*'); // required
      expect(section).toContain('encoding: string'); // optional
    });

    it('should handle capabilities without parameters', () => {
      const registry = createRegistry();
      const cap = mockCapability({ parameters: {} });
      registry.register(cap);

      const section = registry.getSystemPromptSection();

      expect(section).toContain('**Parameters:** `{}`');
    });

    it('should filter by tags', () => {
      const registry = createRegistry();
      const cap1 = mockCapability({ id: 'cap1', tags: ['important', 'file'] });
      const cap2 = mockCapability({ id: 'cap2', tags: ['file'] });
      registry.register(cap1);
      registry.register(cap2);

      const section = registry.getSystemPromptSection({ filterTags: ['important'] });

      expect(section).toContain('cap1');
      expect(section).not.toContain('cap2');
    });

    it('should exclude by tags', () => {
      const registry = createRegistry();
      const cap1 = mockCapability({ id: 'cap1', tags: ['important', 'file'] });
      const cap2 = mockCapability({ id: 'cap2', tags: ['deprecated'] });
      registry.register(cap1);
      registry.register(cap2);

      const section = registry.getSystemPromptSection({ excludeTags: ['deprecated'] });

      expect(section).toContain('cap1');
      expect(section).not.toContain('cap2');
    });

    it('should sort by name', () => {
      const registry = createRegistry();
      registry.register(mockCapability({ id: 'cap1', name: 'Zebra Tool' }));
      registry.register(mockCapability({ id: 'cap2', name: 'Alpha Tool' }));
      registry.register(mockCapability({ id: 'cap3', name: 'Beta Tool' }));

      const section = registry.getSystemPromptSection({ sortBy: 'name' });

      const lines = section.split('\n');
      const capabilityLines = lines.filter(l => l.startsWith('### '));
      expect(capabilityLines[0]).toContain('Alpha Tool');
      expect(capabilityLines[1]).toContain('Beta Tool');
      expect(capabilityLines[2]).toContain('Zebra Tool');
    });

    it('should sort by plugin', () => {
      const registry = createRegistry();
      registry.register(mockCapability({ id: 'cap1', name: 'B tool', pluginId: 'pluginA' }));
      registry.register(mockCapability({ id: 'cap2', name: 'A tool', pluginId: 'pluginB' }));
      registry.register(mockCapability({ id: 'cap3', name: 'C tool', pluginId: 'pluginA' }));

      const section = registry.getSystemPromptSection({ sortBy: 'plugin' });

      const lines = section.split('\n');
      const capabilityLines = lines.filter(l => l.startsWith('### '));
      // Expect pluginA tools first (sorted by name), then pluginB
      expect(capabilityLines[0]).toContain('B tool'); // pluginA, name B before C
      expect(capabilityLines[1]).toContain('C tool');
      expect(capabilityLines[2]).toContain('A tool'); // pluginB
    });

    it('should limit number of capabilities', () => {
      const registry = createRegistry();
      for (let i = 0; i < 5; i++) {
        registry.register(mockCapability({ id: `cap${i}`, name: `Tool ${i}` }));
      }

      const section = registry.getSystemPromptSection({ maxCapabilities: 3 });

      const lines = section.split('\n');
      const capabilityLines = lines.filter(l => l.startsWith('### '));
      expect(capabilityLines).toHaveLength(3);
    });

    it('should combine multiple filters', () => {
      const registry = createRegistry();
      registry.register(mockCapability({ id: 'cap1', tags: ['file', 'read'], pluginId: 'p1', name: 'Z Read' }));
      registry.register(mockCapability({ id: 'cap2', tags: ['file', 'write'], pluginId: 'p2', name: 'A Write' }));
      registry.register(mockCapability({ id: 'cap3', tags: ['network'], pluginId: 'p1', name: 'M Network' }));

      const section = registry.getSystemPromptSection({
        filterTags: ['file'],
        excludeTags: ['write'],
        sortBy: 'name',
      });

      expect(section).toContain('cap1');
      expect(section).not.toContain('cap2');
      expect(section).not.toContain('cap3');
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const registry = createRegistry();
      registry.register(mockCapability({ id: 'cap1', pluginId: 'plugin1', tags: ['tag1', 'tag2'] }));
      registry.register(mockCapability({ id: 'cap2', pluginId: 'plugin1', tags: ['tag1'] }));
      registry.register(mockCapability({ id: 'cap3', pluginId: 'plugin2', tags: ['tag2'] }));

      const stats = registry.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byPlugin['plugin1']).toBe(2);
      expect(stats.byPlugin['plugin2']).toBe(1);
      expect(stats.byTag['tag1']).toBe(2);
      expect(stats.byTag['tag2']).toBe(2);
    });

    it('should return empty objects when no capabilities', () => {
      const registry = createRegistry();

      const stats = registry.getStats();

      expect(stats.total).toBe(0);
      expect(stats.byPlugin).toEqual({});
      expect(stats.byTag).toEqual({});
    });
  });

  describe('singleton', () => {
    beforeEach(() => {
      resetCapabilityRegistry();
    });

    it('should return the same instance from getCapabilityRegistry', () => {
      const instance1 = getCapabilityRegistry();
      const instance2 = getCapabilityRegistry();

      expect(instance1).toBe(instance2);
    });

    it('should allow resetting the global registry', () => {
      const instance1 = getCapabilityRegistry();
      instance1.register(mockCapability());

      resetCapabilityRegistry();

      const instance2 = getCapabilityRegistry();
      expect(instance1).not.toBe(instance2);
      expect(instance2.listAll()).toHaveLength(0);
    });

    it('createRegistry returns isolated instance', () => {
      const instance1 = getCapabilityRegistry();
      const isolated = createRegistry();

      expect(isolated).not.toBe(instance1);
      isolated.register(mockCapability({ id: 'isolated-cap' }));
      expect(instance1.has('isolated-cap')).toBe(false);
    });
  });
});
