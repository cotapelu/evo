import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerAllCustomTools } from './custom-tools.js';

// Mock the @deps module (for spying on create*ToolDefinition calls)
vi.mock('../deps.js', () => {
  const createMockTool = (name: string) => ({
    name,
    description: `Mock ${name} tool`,
    parameters: [],
  });

  return {
    createReadToolDefinition: vi.fn(() => createMockTool('read')),
    createBashToolDefinition: vi.fn(() => createMockTool('bash')),
    createEditToolDefinition: vi.fn(() => createMockTool('edit')),
    createWriteToolDefinition: vi.fn(() => createMockTool('write')),
    createFindToolDefinition: vi.fn(() => createMockTool('find')),
    createGrepToolDefinition: vi.fn(() => createMockTool('grep')),
    createLsToolDefinition: vi.fn(() => createMockTool('ls')),
    type: {},
  };
});

describe('custom-tools (with wrappers)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerAllCustomTools', () => {
    it('should register 7 custom wrapper tools with "custom-" prefix', () => {
      const tools = registerAllCustomTools('/fake/cwd');
      expect(tools).toHaveLength(7);
      expect(tools.map(t => t.name)).toEqual([
        'custom-read',
        'custom-bash',
        'custom-edit',
        'custom-write',
        'custom-find',
        'custom-grep',
        'custom-ls',
      ]);
    });

    it('should add "(custom wrapper)" suffix to descriptions', () => {
      const tools = registerAllCustomTools('/fake/cwd');
      tools.forEach(tool => {
        expect(tool.description).toContain('(custom wrapper)');
      });
    });

    it('should call all create*ToolDefinition functions with provided cwd', async () => {
      const deps = await import('../deps.js');
      const cwd = '/test/cwd';
      registerAllCustomTools(cwd);

      expect(deps.createReadToolDefinition).toHaveBeenCalledWith(cwd);
      expect(deps.createBashToolDefinition).toHaveBeenCalledWith(cwd);
      expect(deps.createEditToolDefinition).toHaveBeenCalledWith(cwd);
      expect(deps.createWriteToolDefinition).toHaveBeenCalledWith(cwd);
      expect(deps.createFindToolDefinition).toHaveBeenCalledWith(cwd);
      expect(deps.createGrepToolDefinition).toHaveBeenCalledWith(cwd);
      expect(deps.createLsToolDefinition).toHaveBeenCalledWith(cwd);
    });

    it('should create distinct tool objects with custom names', () => {
      const tools = registerAllCustomTools('/cwd');
      const names = tools.map(t => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(7); // all distinct
    });
  });
});
