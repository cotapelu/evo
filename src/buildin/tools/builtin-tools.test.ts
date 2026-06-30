import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerAllBuiltinTools } from './builtin-tools.js';

// Mock the @deps module (only need create*Tool for builtin-tools)
vi.mock('../deps.js', () => {
  const createMockTool = (name: string) => ({
    name,
    description: `Mock ${name} tool`,
    parameters: [],
  });

  return {
    createReadTool: vi.fn(() => createMockTool('read')),
    createBashTool: vi.fn(() => createMockTool('bash')),
    createEditTool: vi.fn(() => createMockTool('edit')),
    createWriteTool: vi.fn(() => createMockTool('write')),
    createFindTool: vi.fn(() => createMockTool('find')),
    createGrepTool: vi.fn(() => createMockTool('grep')),
    createLsTool: vi.fn(() => createMockTool('ls')),
  };
});

describe('builtin-tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerAllBuiltinTools', () => {
    it('should register 7 built-in tools with correct names', () => {
      const tools = registerAllBuiltinTools('/fake/cwd');
      expect(tools).toHaveLength(7);
      expect(tools.map(t => t.name)).toEqual([
        'read',
        'bash',
        'edit',
        'write',
        'find',
        'grep',
        'ls',
      ]);
    });

    it('should call each create*Tool function with provided cwd', async () => {
      const deps = await import('../deps.js');
      const cwd = '/test/cwd';
      registerAllBuiltinTools(cwd);

      expect(deps.createReadTool).toHaveBeenCalledTimes(1);
      expect(deps.createReadTool).toHaveBeenCalledWith(cwd);
      expect(deps.createBashTool).toHaveBeenCalledWith(cwd);
      expect(deps.createEditTool).toHaveBeenCalledWith(cwd);
      expect(deps.createWriteTool).toHaveBeenCalledWith(cwd);
      expect(deps.createFindTool).toHaveBeenCalledWith(cwd);
      expect(deps.createGrepTool).toHaveBeenCalledWith(cwd);
      expect(deps.createLsTool).toHaveBeenCalledWith(cwd);
    });
  });
});
