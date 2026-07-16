import { vi, describe, it, expect, beforeEach } from 'vitest';

// Create a shared mock registry instance that tests can configure
const mockRegistry = {
  has: vi.fn(),
  listAll: vi.fn(),
  listByTag: vi.fn(),
  getSystemPromptSection: vi.fn()
};

vi.mock('../../../extensions/capability-system/registry.js', () => ({
  getCapabilityRegistry: vi.fn(() => mockRegistry)
}));

// Now import the module under test
import {
  enhancePromptWithCapabilities,
  getCapabilitiesSection,
  generateSlashCommands,
  parseSlashCommand,
  createCapabilityDiscoveryCapability
} from '../../../extensions/capability-system/prompt-integration.js';

describe('prompt-integration branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistry.has.mockClear();
    mockRegistry.listAll.mockClear();
    mockRegistry.listByTag.mockClear();
    mockRegistry.getSystemPromptSection.mockClear();
  });

  describe('enhancePromptWithCapabilities', () => {
    it('returns basePrompt unchanged when capabilitiesSection empty', () => {
      mockRegistry.getSystemPromptSection.mockReturnValue('');
      const result = enhancePromptWithCapabilities('base prompt');
      expect(result).toBe('base prompt');
    });

    it('inserts capabilities before Guidelines section', () => {
      mockRegistry.getSystemPromptSection.mockReturnValue('## Capabilities');
      const result = enhancePromptWithCapabilities('base\n\n## Guidelines\nmore');
      expect(result).toContain('## Capabilities');
      expect(result).toMatch(/## Capabilities[\s\S]*## Guidelines/);
    });

    it('inserts capabilities before Notes section (no Guidelines)', () => {
      mockRegistry.getSystemPromptSection.mockReturnValue('## Capabilities');
      const result = enhancePromptWithCapabilities('base\n\n## Notes\nmore');
      expect(result).toMatch(/## Capabilities[\s\S]*## Notes/);
    });

    it('appends capabilities at end when neither section present', () => {
      mockRegistry.getSystemPromptSection.mockReturnValue('## Capabilities');
      const result = enhancePromptWithCapabilities('base prompt');
      expect(result).toBe('base prompt\n\n## Capabilities');
    });
  });

  describe('getCapabilitiesSection', () => {
    it('returns registry section string', () => {
      mockRegistry.getSystemPromptSection.mockReturnValue('section text');
      const result = getCapabilitiesSection();
      expect(result).toBe('section text');
    });
  });

  describe('generateSlashCommands', () => {
    it('sorts by plugin by default', () => {
      mockRegistry.listAll.mockReturnValue([
        { id: 'a.b', name: 'B', pluginId: 'a', description: '' },
        { id: 'c.d', name: 'A', pluginId: 'c', description: '' }
      ]);
      const result = generateSlashCommands('plugin');
      expect(result[0].command).toBe('/a.b');
      expect(result[1].command).toBe('/c.d');
    });

    it('sorts by name when requested', () => {
      mockRegistry.listAll.mockReturnValue([
        { id: 'a.b', name: 'B', pluginId: 'a', description: '' },
        { id: 'c.d', name: 'A', pluginId: 'c', description: '' }
      ]);
      const result = generateSlashCommands('name');
      expect(result[0].command).toBe('/c.d'); // A comes before B
      expect(result[1].command).toBe('/a.b');
    });
  });

  describe('parseSlashCommand', () => {
    it('returns null when input does not start with /', () => {
      expect(parseSlashCommand('help')).toBeNull();
    });

    it('returns null when command part empty (only slash)', () => {
      expect(parseSlashCommand('/')).toBeNull();
    });

    it('returns capabilityId when command matches registered capability', () => {
      mockRegistry.has.mockReturnValue(true);
      expect(parseSlashCommand('/my.capability')).toBe('my.capability');
    });

    it('returns null when command not found in registry', () => {
      mockRegistry.has.mockReturnValue(false);
      expect(parseSlashCommand('/unknown')).toBeNull();
    });

    it('converts spaces to dots', () => {
      mockRegistry.has.mockReturnValue(true);
      expect(parseSlashCommand('/my capability')).toBe('my.capability');
    });
  });

  describe('createCapabilityDiscoveryCapability', () => {
    it('includes all capabilities when no filterTag', async () => {
      mockRegistry.listAll.mockReturnValue([
        { id: 'a.b', name: 'B', description: 'desc B', tags: [], promptGuidelines: ['g1', 'g2'] }
      ]);
      const cap = createCapabilityDiscoveryCapability();
      const result = await (cap.execute as any)(null, {}, null, null, null);
      expect(result.isError).toBe(false);
      expect(JSON.parse(result.content[0].text)).toHaveLength(1);
    });

    it('filters by tag when filterTag provided', async () => {
      mockRegistry.listByTag.mockReturnValue([
        { id: 'a.b', name: 'B', description: 'desc B', tags: ['git'], promptGuidelines: ['g1'] }
      ]);
      const cap = createCapabilityDiscoveryCapability();
      const result = await (cap.execute as any)(null, { tag: 'git' }, null, null, null);
      expect(result.isError).toBe(false);
      expect((JSON.parse(result.content[0].text)[0].id)).toBe('a.b');
    });

    it('returns empty list when no capabilities match', async () => {
      mockRegistry.listAll.mockReturnValue([]);
      const cap = createCapabilityDiscoveryCapability();
      const result = await (cap.execute as any)(null, {}, null, null, null);
      expect(JSON.parse(result.content[0].text)).toHaveLength(0);
    });
  });
});
