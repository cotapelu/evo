import { jest } from '@jest/globals';
import { join } from 'node:path';

// Mock node:fs
const mockReaddirSync = jest.fn();
const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();

jest.mock('node:fs', () => ({
  readdirSync: mockReaddirSync,
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

function createMockApi() {
  const handlers: Record<string, Function[]> = {};
  const api: any = {
    on: jest.fn((event: string, handler: Function) => {
      handlers[event] = handlers[event] || [];
      handlers[event].push(handler);
    }),
    registerTool: jest.fn((tool: any) => { api.registeredTool = tool; }),
    registerCommand: jest.fn(),
    sendMessage: jest.fn(),
    getHandlers: () => handlers,
  };
  return api;
}

function createMockContext(custom?: any) {
  return {
    cwd: '/project',
    sdkServices: {
      resourceLoader: {
        getAgentsFiles: jest.fn(() => ({ agentsFiles: [] })),
        reload: jest.fn().mockResolvedValue(undefined),
      },
    },
    ui: { notify: jest.fn() },
    ...custom,
  } as any;
}

// Helper to reset module state (cache)
async function resetAndImport() {
  await jest.resetModules();
  return import('..');
}

describe('Resource Loader Extension', () => {
  let api: any;
  let handler: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReaddirSync.mockReset();
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
    mockReaddirSync.mockReturnValue([]);
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue('');
  });

  describe('registration', () => {
    test('registers resources_discover handler', async () => {
      const { default: register } = await resetAndImport();
      api = createMockApi();
      register(api);
      expect(api.on).toHaveBeenCalledWith('resources_discover', expect.any(Function));
    });

    test('registers resources.list tool', async () => {
      const { default: register } = await resetAndImport();
      api = createMockApi();
      register(api);
      expect(api.registerTool).toHaveBeenCalledWith(expect.objectContaining({ name: 'resources.list' }));
    });

    test('registers resources.reload and resources.list commands', async () => {
      const { default: register } = await resetAndImport();
      api = createMockApi();
      register(api);
      expect(api.registerCommand).toHaveBeenCalledWith('resources.list', expect.any(Object));
      expect(api.registerCommand).toHaveBeenCalledWith('resources.reload', expect.any(Object));
    });
  });

  describe('resources_discover handler', () => {
    test('scans project docs and caches result', async () => {
      const { default: register } = await resetAndImport();
      api = createMockApi();
      register(api);
      const handlers = api.getHandlers();
      handler = handlers['resources_discover'][0];

      const cwd = '/project';
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === cwd) {
          return [
            { name: 'AGENTS.md', isDirectory: () => false },
            { name: 'docs', isDirectory: () => true },
          ];
        } else if (dir === join(cwd, 'docs')) {
          return [{ name: 'README.md', isDirectory: () => false }];
        }
        return [];
      });
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation((path: string) => {
        if (path.endsWith('AGENTS.md')) return '# Agents';
        if (path.endsWith('README.md')) return '# Readme';
        return '';
      });

      const baseResult = { agentsFiles: [] };
      const res1 = await handler({ result: baseResult, cwd }, {});
      expect(mockReaddirSync).toHaveBeenCalledTimes(1);
      expect(res1.agentsFiles.some((f: any) => f.path === 'AGENTS.md')).toBe(true);
      expect(res1.agentsFiles.some((f: any) => f.path === 'docs/README.md')).toBe(true);

      // Second call uses cache (same reference)
      const res2 = await handler({ result: baseResult, cwd }, {});
      expect(res1).toBe(res2);
      expect(mockReaddirSync).toHaveBeenCalledTimes(1); // still only one scan
    });
  });

  describe('resources.list tool', () => {
    let tool: any;

    beforeEach(async () => {
      const { default: register } = await resetAndImport();
      api = createMockApi();
      register(api);
      tool = api.registerTool.mock.calls.find((c: any) => c[0].name === 'resources.list')[0];
    });

    test('tool metadata', () => {
      expect(tool.name).toBe('resources.list');
    });

    test('execute returns loaded resources', async () => {
      const mockAgents = { agentsFiles: [{ path: 'AGENTS.md', content: '...' }] };
      const ctx = createMockContext({
        sdkServices: { resourceLoader: { getAgentsFiles: () => mockAgents } },
      } as any);
      const result = await tool.execute('1', {}, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Loaded resources (1)');
      expect(result.details.count).toBe(1);
    });

    test('execute handles missing resourceLoader', async () => {
      const ctx = createMockContext({ sdkServices: null } as any);
      const result = await tool.execute('1', {}, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('ResourceLoader not initialized');
    });
  });

  describe('resources.reload command', () => {
    test('handler calls resourceLoader.reload and sends notification', async () => {
      const { default: register } = await resetAndImport();
      api = createMockApi();
      register(api);
      const reloadCmd = api.registerCommand.mock.calls.find((c: any) => c[0] === 'resources.reload')[1];
      const mockResourceLoader: any = { reload: jest.fn().mockResolvedValue(undefined) };
      const ctx = createMockContext({ sdkServices: { resourceLoader: mockResourceLoader } } as any);
      ctx.ui = { notify: jest.fn() };
      await reloadCmd.handler('', ctx);
      expect(mockResourceLoader.reload).toHaveBeenCalled();
      expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('reloaded'), 'success');
    });
  });
});
