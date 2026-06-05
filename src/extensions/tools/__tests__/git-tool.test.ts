import { jest } from '@jest/globals';
import { registerGitTool } from '../git-tool.js';

function createMockApi(overrides: any = {}) {
  const api: any = {
    on: jest.fn(),
    registerTool: jest.fn((tool: any) => { api.registeredTool = tool; }),
    exec: jest.fn().mockImplementation(async () => ({ stdout: '', stderr: '', code: 0 })),
    ...overrides,
  };
  return api;
}

function createMockContext(overrides: any = {}) {
  return {
    sessionManager: { getCwd: jest.fn(() => '/workspace') },
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

describe('Git Tool', () => {
  let api: any;
  let tool: any;

  beforeEach(async () => {
    jest.resetModules();
    api = createMockApi();
    const mod = await import('../git-tool.js');
    mod.registerGitTool(api);
    tool = api.registeredTool;
    expect(tool).toBeDefined();
    expect(tool.name).toBe('git');
  });

  test('status: returns git status output', async () => {
    api.exec.mockImplementation(async () => ({ stdout: 'On branch main\nnothing to commit', stderr: '', code: 0 }));
    const ctx = createMockContext();
    const result = await tool.execute('1', { action: 'status' }, undefined, undefined, ctx);
    expect(api.exec).toHaveBeenCalledWith('git', ['status', '--porcelain'], expect.objectContaining({ cwd: '/workspace' }));
    expect(result.isError).toBe(false);
    expect(result.details?.stdout).toContain('On branch');
  });

  test('diff: with file path', async () => {
    api.exec.mockImplementation(async () => ({ stdout: 'diff --git a/file.txt b/file.txt', stderr: '', code: 0 }));
    const ctx = createMockContext();
    const result = await tool.execute('1', { action: 'diff', path: 'file.txt' }, undefined, undefined, ctx);
    expect(api.exec).toHaveBeenCalledWith('git', ['diff', '--', 'file.txt'], expect.objectContaining({ cwd: '/workspace' }));
    expect(result.isError).toBe(false);
  });

  test('diff: without path uses HEAD', async () => {
    api.exec.mockImplementation(async () => ({ stdout: 'diff --git a/file.txt b/file.txt', stderr: '', code: 0 }));
    const ctx = createMockContext();
    const result = await tool.execute('1', { action: 'diff' }, undefined, undefined, ctx);
    expect(api.exec).toHaveBeenCalledWith('git', ['diff', 'HEAD'], expect.objectContaining({ cwd: '/workspace' }));
    expect(result.isError).toBe(false);
  });

  test('commit: requires message', async () => {
    const ctx = createMockContext();
    const result = await tool.execute('1', { action: 'commit' }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('message required');
  });

  test('commit: with message performs commit', async () => {
    api.exec.mockImplementation(async () => ({ stdout: '[main 123456] commit message', stderr: '', code: 0 }));
    const ctx = createMockContext();
    // Confirm dialog should succeed
    ctx.ui.confirm.mockImplementation(() => Promise.resolve(true));
    const result = await tool.execute('1', { action: 'commit', message: 'my commit' }, undefined, undefined, ctx);
    expect(api.exec).toHaveBeenCalledWith('git', ['commit', '-m', 'my commit'], expect.objectContaining({ cwd: '/workspace' }));
    expect(result.isError).toBe(false);
  });

  test('add: requires files', async () => {
    const ctx = createMockContext();
    const result = await tool.execute('1', { action: 'add' }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('files required');
  });

  test('add: with files stages them', async () => {
    api.exec.mockImplementation(async () => ({ stdout: '', stderr: '', code: 0 }));
    const ctx = createMockContext();
    const result = await tool.execute('1', { action: 'add', files: ['a.txt', 'b.txt'] }, undefined, undefined, ctx);
    expect(api.exec).toHaveBeenCalledWith('git', ['add', 'a.txt', 'b.txt'], expect.objectContaining({ cwd: '/workspace' }));
    expect(result.isError).toBe(false);
  });

  test('push: default origin current branch', async () => {
    api.exec.mockImplementation(async () => ({ stdout: '', stderr: '', code: 0 }));
    const ctx = createMockContext();
    const result = await tool.execute('1', { action: 'push' }, undefined, undefined, ctx);
    expect(api.exec).toHaveBeenCalledWith('git', ['push', 'origin', 'HEAD'], expect.objectContaining({ cwd: '/workspace' }));
    expect(result.isError).toBe(false);
  });

  test('push: with remote and branch', async () => {
    api.exec.mockImplementation(async () => ({ stdout: '', stderr: '', code: 0 }));
    const ctx = createMockContext();
    const result = await tool.execute('1', { action: 'push', remote: 'upstream', branch: 'feature' }, undefined, undefined, ctx);
    expect(api.exec).toHaveBeenCalledWith('git', ['push', 'upstream', 'feature'], expect.objectContaining({ cwd: '/workspace' }));
    expect(result.isError).toBe(false);
  });

  test('pull: default origin current branch', async () => {
    api.exec.mockImplementation(async () => ({ stdout: '', stderr: '', code: 0 }));
    const ctx = createMockContext();
    const result = await tool.execute('1', { action: 'pull' }, undefined, undefined, ctx);
    expect(api.exec).toHaveBeenCalledWith('git', ['pull', 'origin', 'HEAD'], expect.objectContaining({ cwd: '/workspace' }));
    expect(result.isError).toBe(false);
  });

  test('log: default 10 entries', async () => {
    api.exec.mockImplementation(async () => ({ stdout: 'commit 123', stderr: '', code: 0 }));
    const ctx = createMockContext();
    const result = await tool.execute('1', { action: 'log' }, undefined, undefined, ctx);
    expect(api.exec).toHaveBeenCalledWith('git', ['log', '--oneline', '-n', '10'], expect.objectContaining({ cwd: '/workspace' }));
    expect(result.isError).toBe(false);
  });

  test('log: custom count', async () => {
    api.exec.mockImplementation(async () => ({ stdout: 'commit 123', stderr: '', code: 0 }));
    const ctx = createMockContext();
    const result = await tool.execute('1', { action: 'log', count: 20 }, undefined, undefined, ctx);
    expect(api.exec).toHaveBeenCalledWith('git', ['log', '--oneline', '-n', '20'], expect.objectContaining({ cwd: '/workspace' }));
    expect(result.isError).toBe(false);
  });

  test('non-zero exit code returns error', async () => {
    api.exec.mockImplementation(async () => ({ stdout: '', stderr: 'error', code: 1 }));
    const ctx = createMockContext();
    const result = await tool.execute('1', { action: 'status' }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
  });

  test('unknown action', async () => {
    const ctx = createMockContext();
    const result = await tool.execute('1', { action: 'unknown' }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid action');
  });

  test('abort signal passed to exec', async () => {
    const signal = new AbortController().signal;
    api.exec.mockImplementation(async () => ({ stdout: '', stderr: '', code: 0 }));
    const ctx = createMockContext();
    await tool.execute('1', { action: 'status' }, signal, undefined, ctx);
    expect(api.exec).toHaveBeenCalledWith(expect.any(String), expect.any(Array), expect.objectContaining({ signal, cwd: '/workspace' }));
  });

  // Render coverage tests
  test('renderCall produces Text for various actions', () => {
    const theme = { fg: (c: string, s: string) => s, bold: (s: string) => s } as any;
    expect(tool.renderCall({ action: 'status' }, theme)).toBeDefined();
    expect(tool.renderCall({ action: 'diff' }, theme)).toBeDefined();
    expect(tool.renderCall({ action: 'commit' }, theme)).toBeDefined();
    expect(tool.renderCall({}, theme)).toBeDefined(); // missing action
  });

  test('renderResult for success (expanded)', () => {
    const theme = { fg: (c: string, s: string) => s, success: (s: string) => s, dim: (s: string) => s } as any;
    const result = tool.renderResult({
      details: { action: 'status', exitCode: 0, success: true, stdout: 'clean', stderr: '' }
    }, { expanded: true, isPartial: false }, theme);
    expect(result).toBeDefined();
  });

  test('renderResult for failure', () => {
    const theme = { fg: (c: string, s: string) => s, error: (s: string) => s } as any;
    const result = tool.renderResult({
      details: { action: 'push', exitCode: 1, success: false, stdout: '', stderr: 'error' }
    }, { expanded: false, isPartial: false }, theme);
    expect(result).toBeDefined();
  });

  test('renderResult for partial', () => {
    const theme = { fg: (c: string, s: string) => s, warning: (s: string) => s } as any;
    const result = tool.renderResult({}, { expanded: false, isPartial: true }, theme);
    expect(result).toBeDefined();
  });

  test('renderResult with no details returns empty', () => {
    const theme = { fg: (c: string, s: string) => s } as any;
    const result = tool.renderResult({ details: undefined }, { expanded: false, isPartial: false }, theme);
    expect(result).toBeDefined();
  });
});
