import { describe, it, expect, beforeEach } from 'vitest';
import { getCapabilityRegistry, resetCapabilityRegistry, createRegistry } from '../../../extensions/capability-system/registry.js';
import type { Capability } from '../../../extensions/capability-system/types.js';

function mockCapability(overrides: Partial<Capability> = {}): Capability {
  return {
    id: 'test.cap',
    name: 'Test Cap',
    description: 'A test capability',
    pluginId: 'test.plugin',
    tags: ['test'],
    parameters: {},
    promptGuidelines: [],
    renderResult: undefined,
    ...overrides,
  };
}

describe('Capability Registry', () => {
  beforeEach(() => {
    resetCapabilityRegistry();
  });

  it('register should add capability', () => {
    const registry = getCapabilityRegistry();
    const cap = mockCapability({ id: 'cap1' });
    registry.register(cap);
    expect(registry.has('cap1')).toBe(true);
    expect(registry.get('cap1')).toBe(cap);
  });

  it('register duplicate should throw', () => {
    const registry = getCapabilityRegistry();
    const cap = mockCapability({ id: 'cap1' });
    registry.register(cap);
    expect(() => registry.register(cap)).toThrow("Capability 'cap1' is already registered");
  });

  it('unregister should remove capability', () => {
    const registry = getCapabilityRegistry();
    const cap = mockCapability({ id: 'cap1', pluginId: 'p1' });
    registry.register(cap);
    expect(registry.unregister('cap1')).toBe(true);
    expect(registry.has('cap1')).toBe(false);
    // Check plugin cleanup
    expect(registry.listByPlugin('p1')).toHaveLength(0);
  });

  it('unregister non-existing returns false', () => {
    const registry = getCapabilityRegistry();
    expect(registry.unregister('nonexistent')).toBe(false);
  });

  it('listAll returns all capabilities', () => {
    const registry = getCapabilityRegistry();
    registry.register(mockCapability({ id: 'cap1' }));
    registry.register(mockCapability({ id: 'cap2' }));
    const all = registry.listAll();
    expect(all).toHaveLength(2);
  });

  it('listByPlugin returns capabilities for plugin', () => {
    const registry = getCapabilityRegistry();
    registry.register(mockCapability({ id: 'cap1', pluginId: 'pluginA' }));
    registry.register(mockCapability({ id: 'cap2', pluginId: 'pluginB' }));
    registry.register(mockCapability({ id: 'cap3', pluginId: 'pluginA' }));
    const pluginACaps = registry.listByPlugin('pluginA');
    expect(pluginACaps).toHaveLength(2);
    expect(pluginACaps.map(c => c.id).sort()).toEqual(['cap1', 'cap3']);
  });

  it('listByPlugin returns empty for unknown plugin', () => {
    const registry = getCapabilityRegistry();
    expect(registry.listByPlugin('unknown')).toHaveLength(0);
  });

  it('listByTag filters by tag', () => {
    const registry = getCapabilityRegistry();
    registry.register(mockCapability({ id: 'cap1', tags: ['tag1', 'common'] }));
    registry.register(mockCapability({ id: 'cap2', tags: ['tag2', 'common'] }));
    registry.register(mockCapability({ id: 'cap3', tags: ['tag3'] }));
    const tag1 = registry.listByTag('tag1');
    expect(tag1).toHaveLength(1);
    expect(tag1[0].id).toBe('cap1');
    const common = registry.listByTag('common');
    expect(common).toHaveLength(2);
  });

  it('search finds by name', () => {
    const registry = getCapabilityRegistry();
    registry.register(mockCapability({ id: 'cap1', name: 'Get User' }));
    registry.register(mockCapability({ id: 'cap2', name: 'Set User' }));
    const results = registry.search('get');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('cap1');
  });

  it('search finds by description', () => {
    const registry = getCapabilityRegistry();
    registry.register(mockCapability({ id: 'cap1', description: 'Retrieves user data' }));
    registry.register(mockCapability({ id: 'cap2', description: 'Sets user data' }));
    const results = registry.search('retrieves');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('cap1');
  });

  it('search finds by id', () => {
    const registry = getCapabilityRegistry();
    registry.register(mockCapability({ id: 'git.status' }));
    const results = registry.search('git');
    expect(results.some(c => c.id === 'git.status')).toBe(true);
  });

  it('search finds by tag', () => {
    const registry = getCapabilityRegistry();
    registry.register(mockCapability({ id: 'cap1', tags: ['network'] }));
    registry.register(mockCapability({ id: 'cap2', tags: ['file'] }));
    const results = registry.search('net');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('cap1');
  });

  it('search is case-insensitive', () => {
    const registry = getCapabilityRegistry();
    registry.register(mockCapability({ id: 'CapOne', name: 'Upper' }));
    const results = registry.search('upper');
    expect(results).toHaveLength(1);
  });

  it('getCapabilityIds returns all ids', () => {
    const registry = getCapabilityRegistry();
    registry.register(mockCapability({ id: 'a' }));
    registry.register(mockCapability({ id: 'b' }));
    registry.register(mockCapability({ id: 'c' }));
    const ids = registry.getCapabilityIds();
    expect(ids.sort()).toEqual(['a', 'b', 'c']);
  });

  describe('getSystemPromptSection', () => {
    it('returns empty string when no capabilities', () => {
      const registry = getCapabilityRegistry();
      const section = registry.getSystemPromptSection();
      expect(section).toBe('');
    });

    it('includes capability name, id, description', () => {
      const registry = getCapabilityRegistry();
      registry.register(mockCapability({
        id: 'test.foo',
        name: 'Foo',
        description: 'Does foo things',
        parameters: {},
      }));
      const section = registry.getSystemPromptSection();
      expect(section).toContain('### Foo');
      expect(section).toContain('ID: `test.foo`');
      expect(section).toContain('Does foo things');
    });

    it('includes guidelines if present', () => {
      const registry = getCapabilityRegistry();
      registry.register(mockCapability({
        id: 'test.bar',
        name: 'Bar',
        description: 'Bar desc',
        parameters: {},
        promptGuidelines: ['Use with caution', 'Do not abuse'],
      }));
      const section = registry.getSystemPromptSection();
      expect(section).toContain('- Use with caution');
      expect(section).toContain('- Do not abuse');
    });

    it('includes parameter summary', () => {
      const registry = getCapabilityRegistry();
      registry.register(mockCapability({
        id: 'test.param',
        name: 'Param',
        description: 'Param test',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            force: { type: 'boolean' },
          },
          required: ['path'],
        },
      }));
      const section = registry.getSystemPromptSection();
      expect(section).toContain('**Parameters:**');
      // The summary format: "path: string*, force: boolean"
      expect(section).toMatch(/path:\s*string\*/);
      expect(section).toMatch(/force:\s*boolean/);
    });

    it('filters by tags', () => {
      const registry = getCapabilityRegistry();
      registry.register(mockCapability({ id: 'c1', tags: ['git', 'vcs'] }));
      registry.register(mockCapability({ id: 'c2', tags: ['file'] }));
      const section = registry.getSystemPromptSection({ filterTags: ['git'] });
      expect(section).toContain('c1');
      expect(section).not.toContain('c2');
    });

    it('excludes by tags', () => {
      const registry = getCapabilityRegistry();
      registry.register(mockCapability({ id: 'c1', tags: ['git'] }));
      registry.register(mockCapability({ id: 'c2', tags: ['file'] }));
      const section = registry.getSystemPromptSection({ excludeTags: ['git'] });
      expect(section).toContain('c2');
      expect(section).not.toContain('c1');
    });

    it('sorts by name', () => {
      const registry = getCapabilityRegistry();
      registry.register(mockCapability({ id: 'c1', name: 'Zulu' }));
      registry.register(mockCapability({ id: 'c2', name: 'Alpha' }));
      const section = registry.getSystemPromptSection({ sortBy: 'name' });
      const zuluPos = section.indexOf('Zulu');
      const alphaPos = section.indexOf('Alpha');
      expect(alphaPos).toBeLessThan(zuluPos);
    });

    it('sorts by plugin', () => {
      const registry = getCapabilityRegistry();
      registry.register(mockCapability({ id: 'c1', pluginId: 'B', name: 'B-Cap' }));
      registry.register(mockCapability({ id: 'c2', pluginId: 'A', name: 'A-Cap' }));
      const section = registry.getSystemPromptSection({ sortBy: 'plugin' });
      const aPos = section.indexOf('A-Cap');
      const bPos = section.indexOf('B-Cap');
      expect(aPos).toBeLessThan(bPos);
    });

    it('limits maxCapabilities', () => {
      const registry = getCapabilityRegistry();
      for (let i = 0; i < 5; i++) {
        registry.register(mockCapability({ id: `c${i}`, name: `Cap ${i}` }));
      }
      const section = registry.getSystemPromptSection({ maxCapabilities: 3 });
      // Should contain only first 3 (no sort specified, original order)
      expect(section).toContain('Cap 0');
      expect(section).toContain('Cap 1');
      expect(section).toContain('Cap 2');
      expect(section).not.toContain('Cap 3');
      expect(section).not.toContain('Cap 4');
    });
  });

  describe('getStats', () => {
    it('returns correct counts', () => {
      const registry = getCapabilityRegistry();
      registry.register(mockCapability({ id: 'c1', pluginId: 'p1', tags: ['t1'] }));
      registry.register(mockCapability({ id: 'c2', pluginId: 'p1', tags: ['t2'] }));
      registry.register(mockCapability({ id: 'c3', pluginId: 'p2', tags: ['t1'] }));
      const stats = registry.getStats();
      expect(stats.total).toBe(3);
      expect(stats.byPlugin).toEqual({ p1: 2, p2: 1 });
      expect(stats.byTag).toEqual({ t1: 2, t2: 1 });
    });
  });

  describe('summarizeParameters', () => {
    it('handles empty schema', () => {
      const registry = getCapabilityRegistry();
      // Access private method via any
      const summary = (registry as any).summarizeParameters(null);
      expect(summary).toBe('{}');
    });

    it('summarizes properties with types and required', () => {
      const registry = getCapabilityRegistry();
      const schema = {
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      };
      const summary = (registry as any).summarizeParameters(schema);
      // Expect something like "name: string*, age: number"
      expect(summary).toContain('name: string*');
      expect(summary).toContain('age: number');
    });
  });

  describe('singleton behavior', () => {
    it('getCapabilityRegistry returns same instance', () => {
      const r1 = getCapabilityRegistry();
      const r2 = getCapabilityRegistry();
      expect(r1).toBe(r2);
    });

    it('createRegistry returns new isolated instance', () => {
      const r1 = createRegistry();
      const r2 = createRegistry();
      expect(r1).not.toBe(r2);
    });
  });
});
