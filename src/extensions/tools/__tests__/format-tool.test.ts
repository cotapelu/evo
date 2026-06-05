import { jest } from '@jest/globals';
import { registerFormatTool } from '../format-tool.js';

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

describe('Format Tool', () => {
  let api: any;
  let tool: any;

  beforeEach(async () => {
    jest.resetModules();
    api = createMockApi();
    const mod = await import('../format-tool.js');
    mod.registerFormatTool(api);
    tool = api.registeredTool;
    expect(tool).toBeDefined();
    expect(tool.name).toBe('format');
  });

  test('executes npx prettier --write .', async () => {
    api.exec.mockResolvedValue({ stdout: 'formatted', stderr: '', code: 0 } as any);
    const ctx = createMockContext();
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(api.exec).toHaveBeenCalledWith('npx', ['prettier', '--write', '.'], expect.objectContaining({ cwd: '/workspace' }));
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('✅');
  });

  test('handles non-zero exit code', async () => {
    api.exec.mockResolvedValue({ stdout: '', stderr: 'error', code: 1 } as any);
    const ctx = createMockContext();
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('❌');
  });

  test('handles exec exception', async () => {
    api.exec.mockRejectedValue(new Error('spawn failed'));
    const ctx = createMockContext();
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.details?.error).toBe('spawn failed');
  });

  test('passes abort signal', async () => {
    const signal = new AbortController().signal;
    api.exec.mockResolvedValue({ stdout: '', stderr: '', code: 0 } as any);
    const ctx = createMockContext();
    await tool.execute('1', {}, signal, undefined, ctx);
    expect(api.exec).toHaveBeenCalledWith(expect.any(String), expect.any(Array), expect.objectContaining({ signal, cwd: '/workspace' }));
  });
});
