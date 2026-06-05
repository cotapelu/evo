import { jest } from '@jest/globals';
import { registerSessionInfoTool } from '../session-info.js';

function createMockApi() {
  const api: any = {
    on: jest.fn(),
    registerTool: jest.fn((tool: any) => { api.registeredTool = tool; }),
  };
  return api;
}

function createMockContext(overrides: any = {}) {
  const defaultSessionManager = {
    getEntries: jest.fn(() => []),
    getTree: jest.fn(() => []),
    getLeafId: jest.fn(() => null),
    getCwd: jest.fn(() => '/workspace'),
    getSessionId: jest.fn(() => 'session-123'),
  };
  return {
    sessionManager: { ...defaultSessionManager, ...overrides.sessionManager },
    cwd: '/workspace',
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
    ...overrides,
  };
}

describe('Session Info Tool', () => {
  let api: any;
  let tool: any;

  beforeEach(async () => {
    jest.resetModules();
    api = createMockApi();
    const mod = await import('../session-info.js');
    mod.registerSessionInfoTool(api);
    tool = api.registeredTool;
    expect(tool).toBeDefined();
    expect(tool.name).toBe('session_info');
  });

  test('returns session statistics', async () => {
    const mockEntries = [
      { id: '1', parentId: null, type: 'message', timestamp: '2024-01-01T00:00:00Z' },
      { id: '2', parentId: '1', type: 'message', timestamp: '2024-01-01T00:01:00Z' },
      { id: '3', parentId: '2', type: 'compaction', summary: 'compacted', firstKeptEntryId: '2', tokensBefore: 100, timestamp: '2024-01-01T00:02:00Z' },
      { id: '4', parentId: '3', type: 'branch_summary', fromId: '2', summary: 'branch', timestamp: '2024-01-01T00:03:00Z' },
      { id: '5', parentId: '3', type: 'label', targetId: '2', label: 'v1', timestamp: '2024-01-01T00:04:00Z' },
    ];
    const mockTree = [{ entry: { id: '1', parentId: null, type: 'session' }, children: [] }];
    const ctx = createMockContext({
      sessionManager: {
        getEntries: jest.fn(() => mockEntries),
        getTree: jest.fn(() => mockTree),
        getLeafId: jest.fn(() => '3'),
        getCwd: jest.fn(() => '/my/project'),
        getSessionId: jest.fn(() => 'sess-abc'),
      },
    });

    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    const info = result.details;
    expect(info.session_id).toBe('sess-abc');
    expect(info.cwd).toBe('/my/project');
    expect(info.leaf_id).toBe('3');
    expect(info.total_entries).toBe(5);
    expect(info.message_count).toBe(2);
    expect(info.compaction_count).toBe(1);
    expect(info.branch_summary_count).toBe(1);
    expect(info.label_count).toBe(1);
    expect(info.root_nodes).toBe(1);
    expect(typeof info.estimated_tokens).toBe('number');
    expect(info.estimated_tokens).toBeGreaterThan(0);
  });

  test('handles empty session', async () => {
    const ctx = createMockContext({
      sessionManager: {
        getEntries: jest.fn(() => []),
        getTree: jest.fn(() => []),
        getLeafId: jest.fn(() => null),
        getCwd: jest.fn(() => '/workspace'),
        getSessionId: jest.fn(() => 'empty-session'),
      },
    });

    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    const info = result.details;
    expect(info.session_id).toBe('empty-session');
    expect(info.total_entries).toBe(0);
    expect(info.message_count).toBe(0);
    expect(info.estimated_tokens).toBe(0);
    expect(info.leaf_id).toBeNull();
  });

  test('accepts stringified params (ignored)', async () => {
    const ctx = createMockContext();
    const result = await tool.execute('1', '{}', undefined, undefined, ctx);
    expect(result.isError).toBe(false);
  });

  test('handles errors gracefully', async () => {
    const ctx = createMockContext({
      sessionManager: {
        getEntries: jest.fn(() => { throw new Error('DB failure'); }),
        getTree: jest.fn(() => []),
        getLeafId: jest.fn(() => null),
        getCwd: jest.fn(() => '/workspace'),
        getSessionId: jest.fn(() => 'err-session'),
      },
    });

    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.details?.error).toBe('DB failure');
  });

  // Additional coverage tests
  test('renderCall produces Text', () => {
    const theme = { fg: (c: string, s: string) => s, bold: (s: string) => s } as any;
    const txt = tool.renderCall({}, theme);
    expect(txt).toBeDefined();
  });

  test('renderResult shows partial state', () => {
    const theme = { fg: (c: string, s: string) => s, warning: (s: string) => s } as any;
    const txt = tool.renderResult({}, { expanded: false, isPartial: true }, theme);
    expect(txt).toBeDefined();
  });

  test('renderResult shows result with details', () => {
    const theme = { fg: (c: string, s: string) => s, accent: (s: string) => s } as any;
    const result = tool.renderResult({
      details: {
        session_id: 's1',
        cwd: '/home',
        leaf_id: null,
        total_entries: 10,
        message_count: 5,
        compaction_count: 2,
        branch_summary_count: 1,
        label_count: 1,
        estimated_tokens: 100,
        root_nodes: 3,
      }
    }, { expanded: false, isPartial: false }, theme);
    expect(result).toBeDefined();
  });

  test('execute uses fallbacks when sessionManager methods missing', async () => {
    const ctx = {
      cwd: '/fallback',
      sessionManager: {} as any, // no methods
    } as any;
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    const info = result.details;
    expect(info.session_id).toBe('unknown');
    expect(info.cwd).toBe('/fallback');
    expect(info.leaf_id).toBeNull();
    expect(info.total_entries).toBe(0);
    expect(info.estimated_tokens).toBe(0);
    expect(info.root_nodes).toBe(0);
  });
});
