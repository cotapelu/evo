import { jest } from '@jest/globals';
import { registerBranchTool } from '../branch.js';

// Mock API that captures the registered tool
function createMockApi() {
  const handlers: Record<string, Function[]> = {};
  const api: any = {
    on: jest.fn((event: string, handler: Function) => {
      handlers[event] = handlers[event] || [];
      handlers[event].push(handler);
    }),
    registerTool: jest.fn((tool: any) => { api.registeredTool = tool; }),
    getHandlers: () => handlers,
  };
  return api;
}

// Minimal ExtensionContext mock – we only need sessionManager
function createMockContext(manager: any, custom?: any) {
  return {
    sessionManager: manager,
    session: { id: 'test-session' },
    cwd: process.cwd(),
    mode: 'tui' as const,
    hasUI: true,
    signal: undefined,
    abort: jest.fn(),
    isIdle: jest.fn(() => true),
    hasPendingMessages: jest.fn(() => false),
    shutdown: jest.fn(),
    getContextUsage: jest.fn(() => undefined),
    compact: jest.fn(),
    getSystemPrompt: jest.fn(() => ''),
    ui: {
      select: jest.fn(),
      confirm: jest.fn(),
      input: jest.fn(),
      notify: jest.fn(),
      onTerminalInput: jest.fn(() => () => {}),
      setStatus: jest.fn(),
      setWorkingMessage: jest.fn(),
      setWorkingVisible: jest.fn(),
      setWorkingIndicator: jest.fn(),
      setHiddenThinkingLabel: jest.fn(),
      setWidget: jest.fn(),
    },
    ...custom,
  };
}

function createMockSessionManager(overrides: Partial<any> = {}) {
  const manager: any = {
    getEntries: jest.fn(() => []),
    getTree: jest.fn(() => []),
    getBranch: jest.fn(() => []),
    getEntry: jest.fn(),
    getLeafId: jest.fn(() => null),
    getLeafEntry: jest.fn(),
    getLabel: jest.fn(() => undefined),
    ...overrides,
  };
  return manager;
}

describe('Branch Tool', () => {
  let api: any;
  let tool: any;
  let manager: any;
  let ctx: any;

  beforeEach(async () => {
    jest.resetModules();
    api = createMockApi();
    const mod = await import('../branch.js');
    mod.registerBranchTool(api);
    tool = api.registeredTool;
    expect(tool).toBeDefined();
    expect(tool.name).toBe('branch');
    manager = createMockSessionManager();
    ctx = createMockContext(manager);
  });

  test('list_leaves: computes leaves correctly', async () => {
    manager.getEntries = jest.fn(() => [
      { id: '1', parentId: null, type: 'message', timestamp: '2024-01-01T00:00:00Z' },
      { id: '2', parentId: '1', type: 'message', timestamp: '2024-01-01T00:01:00Z' },
      { id: '3', parentId: '2', type: 'message', timestamp: '2024-01-01T00:02:00Z' },
      { id: '4', parentId: '1', type: 'message', timestamp: '2024-01-01T00:03:00Z' },
    ]);
    manager.getLeafId = jest.fn(() => '3');
    manager.getLabel = jest.fn((id: string) => (id === '4' ? 'important' : undefined));

    const result = await tool.execute('1', { action: 'list_leaves' }, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    const leaves = result.details?.leaves;
    expect(leaves).toHaveLength(2);
    const leafIds = leaves.map((l: any) => l.id).sort();
    expect(leafIds).toEqual(['3', '4']);
    const leaf4 = leaves.find((l: any) => l.id === '4');
    expect(leaf4?.label).toBe('important');
    expect(result.content[0].text).toContain('2 leaf');
  });

  test('list_leaves: empty session', async () => {
    manager.getEntries = jest.fn(() => []);
    const result = await tool.execute('1', { action: 'list_leaves' }, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.details?.leaves).toEqual([]);
    expect(result.content[0].text).toContain('0 leaf');
  });

  test('list_labels: returns label entries', async () => {
    manager.getEntries = jest.fn(() => [
      { id: 'l1', parentId: '1', type: 'label', targetId: '2', label: 'v1', timestamp: 't1' },
      { id: 'l2', parentId: '1', type: 'label', targetId: '3', label: 'v2', timestamp: 't2' },
      { id: 'm1', parentId: null, type: 'message', timestamp: 't0' },
    ]);
    const result = await tool.execute('1', { action: 'list_labels' }, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    const labels = result.details?.labels;
    expect(labels).toHaveLength(2);
    expect(labels[0].target_id).toBe('2');
    expect(labels[1].label).toBe('v2');
    expect(result.content[0].text).toContain('2 label');
  });

  test('list_labels: empty', async () => {
    manager.getEntries = jest.fn(() => []);
    const result = await tool.execute('1', { action: 'list_labels' }, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.details?.labels).toEqual([]);
    expect(result.content[0].text).toContain('0 label');
  });

  test('get_entry: requires entry_id', async () => {
    const result = await tool.execute('1', { action: 'get_entry' }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('entry_id required');
  });

  test('get_entry: returns entry', async () => {
    const entry = { id: 'e1', parentId: null, type: 'message', timestamp: 't' };
    manager.getEntry = jest.fn(() => entry);
    const result = await tool.execute('1', { action: 'get_entry', entry_id: 'e1' }, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.details?.entry).toBe(entry);
    expect(result.content[0].text).toContain('Retrieved entry e1');
  });

  test('get_entry: not found', async () => {
    manager.getEntry = jest.fn(() => undefined);
    const result = await tool.execute('1', { action: 'get_entry', entry_id: 'missing' }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Entry not found');
  });

  test('get_leaf: returns current leaf', async () => {
    const leaf = { id: 'leaf1', parentId: 'root', type: 'message', timestamp: 't' };
    manager.getLeafId = jest.fn(() => 'leaf1');
    manager.getLeafEntry = jest.fn(() => leaf);
    const result = await tool.execute('1', { action: 'get_leaf' }, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.details?.leaf).toBe(leaf);
    expect(result.content[0].text).toContain('leaf1');
  });

  test('get_leaf: error if no leaf', async () => {
    manager.getLeafId = jest.fn(() => null);
    manager.getLeafEntry = jest.fn(() => undefined);
    const result = await tool.execute('1', { action: 'get_leaf' }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No leaf');
  });

  test('get_branch: with entry_id', async () => {
    const branch = [
      { id: '3', parentId: '2', type: 'message' },
      { id: '2', parentId: '1', type: 'message' },
      { id: '1', parentId: null, type: 'message' },
    ];
    manager.getBranch = jest.fn(() => branch);
    const result = await tool.execute('1', { action: 'get_branch', entry_id: '3' }, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.details?.branch).toEqual(branch);
    expect(manager.getBranch).toHaveBeenCalledWith('3');
    expect(result.content[0].text).toContain('3');
  });

  test('get_branch: without entry_id uses leaf', async () => {
    manager.getLeafId = jest.fn(() => '2');
    const branch = [{ id: '2' }, { id: '1' }];
    manager.getBranch = jest.fn(() => branch);
    const result = await tool.execute('1', { action: 'get_branch' }, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(manager.getBranch).toHaveBeenCalledWith('2');
  });

  test('get_branch: error if no leaf and no entry_id', async () => {
    manager.getLeafId = jest.fn(() => null);
    const result = await tool.execute('1', { action: 'get_branch' }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No leaf to get branch from');
  });

  test('get_tree: returns tree', async () => {
    const tree = [{ entry: { id: '1', parentId: null, type: 'session' }, children: [] }];
    manager.getTree = jest.fn(() => tree);
    const result = await tool.execute('1', { action: 'get_tree' }, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.details?.tree).toEqual(tree);
    expect(result.content[0].text).toContain('1 root node');
  });

  test('get_tree: empty', async () => {
    manager.getTree = jest.fn(() => []);
    const result = await tool.execute('1', { action: 'get_tree' }, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.details?.tree).toEqual([]);
    expect(result.content[0].text).toContain('0 root nodes');
  });

  test('invalid action', async () => {
    const result = await tool.execute('1', { action: 'unknown' }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid action');
  });

  test('JSON string params', async () => {
    manager.getEntries = jest.fn(() => []);
    const result = await tool.execute('1', '{"action":"list_leaves"}', undefined, undefined, ctx);
    expect(result.isError).toBe(false);
  });

  test('invalid JSON', async () => {
    const result = await tool.execute('1', 'not json', undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid JSON');
  });

  test('empty object params', async () => {
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Missing action');
  });

  test('action not a string', async () => {
    const result = await tool.execute('1', { action: 123 }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Missing action');
  });

  // Additional coverage: render functions
  test('renderCall produces Text', () => {
    const theme = { fg: (c: string, s: string) => s, bold: (s: string) => s } as any;
    const txt = tool.renderCall({ action: 'list_leaves' }, theme);
    expect(txt).toBeDefined();
  });

  test('renderResult for list_leaves success', () => {
    const theme = { fg: (c: string, s: string) => s, success: (s: string) => s, dim: (s: string) => s } as any;
    const result = tool.renderResult({
      details: {
        leaves: [
          { id: '1', label: undefined, is_leaf: true },
          { id: '2', label: 'v1', is_leaf: true }
        ]
      }
    }, { expanded: false, isPartial: false }, theme);
    expect(result).toBeDefined();
  });

  test('renderResult for list_labels success', () => {
    const theme = { fg: (c: string, s: string) => s, accent: (s: string) => s } as any;
    const result = tool.renderResult({
      details: {
        labels: [
          { id: 'l1', target_id: '2', label: 'v1', timestamp: 't' }
        ]
      }
    }, { expanded: false, isPartial: false }, theme);
    expect(result).toBeDefined();
  });

  test('renderResult for error', () => {
    const theme = { fg: (c: string, s: string) => s, error: (s: string) => s } as any;
    const result = tool.renderResult({ isError: true }, { expanded: false, isPartial: false }, theme);
    expect(result).toBeDefined();
  });

  test('renderResult for partial', () => {
    const theme = { fg: (c: string, s: string) => s, warning: (s: string) => s } as any;
    const result = tool.renderResult({}, { expanded: false, isPartial: true }, theme);
    expect(result).toBeDefined();
  });
});
