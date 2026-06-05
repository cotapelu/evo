import { jest } from '@jest/globals';
import { registerCodeHealthTool } from '../code-health-tool.js';

function createMockApi(overrides: any = {}) {
  const execMock = jest.fn().mockImplementation(async () => ({ stdout: '', stderr: '', code: 0 }));
  const api: any = {
    on: jest.fn(),
    registerTool: jest.fn((tool: any) => { api.registeredTool = tool; }),
    exec: execMock,
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

describe('Code Health Tool', () => {
  let api: any;
  let tool: any;

  beforeEach(async () => {
    jest.resetModules();
    api = createMockApi();
    const mod = await import('../code-health-tool.js');
    mod.registerCodeHealthTool(api);
    tool = api.registeredTool;
    expect(tool).toBeDefined();
    expect(tool.name).toBe('code-health');
  });

  test('audit: runs all default checks', async () => {
    api.exec.mockImplementation(async () => ({ stdout: 'OK', stderr: '', code: 0 }));
    const ctx = createMockContext();
    const result = await tool.execute('1', {}, undefined, undefined, ctx);

    // Expect calls for lint, typecheck, test, build
    expect(api.exec).toHaveBeenCalledWith('npm', ['run', 'lint'], expect.objectContaining({ cwd: '/workspace' }));
    expect(api.exec).toHaveBeenCalledWith('npx', ['tsc', '--noEmit'], expect.objectContaining({ cwd: '/workspace' }));
    expect(api.exec).toHaveBeenCalledWith('npm', ['test'], expect.objectContaining({ cwd: '/workspace' }));
    expect(api.exec).toHaveBeenCalledWith('npm', ['run', 'build'], expect.objectContaining({ cwd: '/workspace' }));

    expect(result.isError).toBe(false);
    console.log('DEBUG result:', JSON.stringify(result, null, 2));
    expect(result.details?.overallSuccess).toBe(true);
    expect(result.content[0].text).toContain('All 4 checks passed');
  });

  test('audit: runs subset of checks', async () => {
    api.exec.mockImplementation(async () => ({ stdout: 'OK', stderr: '', code: 0 }));
    const ctx = createMockContext();
    const result = await tool.execute('1', { checks: ['lint', 'test'] }, undefined, undefined, ctx);

    expect(api.exec).toHaveBeenCalledWith('npm', ['run', 'lint'], expect.anything());
    expect(api.exec).toHaveBeenCalledWith('npm', ['test'], expect.anything());
    expect(api.exec).not.toHaveBeenCalledWith('npx', ['tsc', '--noEmit'], expect.anything());
    expect(result.details?.checks).toHaveLength(2);
    expect(result.details?.checks?.[0].name).toBe('lint');
    expect(result.details?.checks?.[1].name).toBe('test');
  });

  test('audit: handles check failure', async () => {
    api.exec.mockImplementation(async (cmd: any, args: any) => {
      if (args.includes('lint')) {
        return { stdout: '', stderr: 'Lint error', code: 1 };
      }
      return { stdout: '', stderr: '', code: 0 };
    });
    const ctx = createMockContext();
    const result = await tool.execute('1', {}, undefined, undefined, ctx);

    expect(result.isError).toBe(true);
    expect(result.details?.overallSuccess).toBe(false);
    expect(result.content[0].text).toContain('1 of 4 checks failed');
    const lintCheck = result.details?.checks.find((c: any) => c.name === 'lint');
    expect(lintCheck.success).toBe(false);
    expect(lintCheck.exitCode).toBe(1);
  });

  test('audit: handles exec exception', async () => {
    api.exec.mockRejectedValue(new Error('Command not found'));
    const ctx = createMockContext();
    const result = await tool.execute('1', { checks: ['build'] }, undefined, undefined, ctx);

    expect(result.isError).toBe(true);
    const buildCheck = result.details?.checks.find((c: any) => c.name === 'build');
    expect(buildCheck.success).toBe(false);
    expect(buildCheck.exitCode).toBe(-1);
    expect(buildCheck.stderr).toContain('Command not found');
  });

  test('audit: empty checks array returns error', async () => {
    const ctx = createMockContext();
    const result = await tool.execute('1', { checks: [] }, undefined, undefined, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No valid checks specified');
  });

  test('audit: includes invalid checks are filtered out', async () => {
    api.exec.mockImplementation(async () => ({ stdout: 'OK', stderr: '', code: 0 }));
    const ctx = createMockContext();
    const result = await tool.execute('1', { checks: ['lint', 'invalid', 'test'] }, undefined, undefined, ctx);

    // Should only call for lint and test
    expect(api.exec).toHaveBeenCalledWith('npm', ['run', 'lint'], expect.anything());
    expect(api.exec).toHaveBeenCalledWith('npm', ['test'], expect.anything());
    expect(api.exec).not.toHaveBeenCalledWith('npm', ['run', 'invalid'], expect.anything());
    // Only 2 checks in result
    expect(result.details?.checks).toHaveLength(2);
  });

  test('abort signal passed to exec', async () => {
    api.exec.mockImplementation(async () => ({ stdout: '', stderr: '', code: 0 }));
    const signal = new AbortController().signal;
    const ctx = createMockContext();
    await tool.execute('1', {}, signal, undefined, ctx);
    // All exec calls should receive the signal
    expect(api.exec).toHaveBeenCalledWith(expect.any(String), expect.any(Array), expect.objectContaining({ signal, cwd: '/workspace' }));
  });



  test('audit: includes audit check', async () => {
    api.exec.mockImplementation(async () => ({ stdout: 'audit results', stderr: '', code: 0 }));
    const ctx = createMockContext();
    const result = await tool.execute('1', { checks: ['audit'] }, undefined, undefined, ctx);
    expect(api.exec).toHaveBeenCalledWith('npm', ['audit'], expect.objectContaining({ cwd: '/workspace' }));
    expect(result.details?.checks).toHaveLength(1);
    expect(result.details?.checks[0].name).toBe('audit');
  });

  test('handles unknown check names gracefully by filtering', async () => {
    api.exec.mockImplementation(async () => ({ stdout: 'OK', stderr: '', code: 0 }));
    const ctx = createMockContext();
    const result = await tool.execute('1', { checks: ['nonexistent'] } as any, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No valid checks');
  });

  // Additional coverage tests
  test('renderCall produces Text for default checks', () => {
    const theme = { fg: (c: string, s: string) => s, bold: (s: string) => s } as any;
    const txt = tool.renderCall({}, theme);
    expect(txt).toBeDefined();
  });

  test('renderCall produces Text for custom checks', () => {
    const theme = { fg: (c: string, s: string) => s, bold: (s: string) => s } as any;
    const txt = tool.renderCall({ checks: ['lint', 'test'] }, theme);
    expect(txt).toBeDefined();
  });

  test('renderResult shows partial state', () => {
    const theme = { fg: (c: string, s: string) => s, warning: (s: string) => s } as any;
    const txt = tool.renderResult({}, { expanded: false, isPartial: true }, theme);
    expect(txt).toBeDefined();
  });

  test('renderResult shows final result with successful checks', () => {
    const theme = { fg: (c: string, s: string) => s, success: (s: string) => s, error: (s: string) => s, accent: (s: string) => s, dim: (s: string) => s } as any;
    const result = tool.renderResult({
      details: {
        checks: [
          { name: 'lint', success: true, exitCode: 0, stderr: '' },
          { name: 'test', success: true, exitCode: 0, stderr: '' }
        ],
        overallSuccess: true
      }
    }, { expanded: false, isPartial: false }, theme);
    expect(result).toBeDefined();
  });

  test('renderResult shows final result with failures', () => {
    const theme = { fg: (c: string, s: string) => s, success: (s: string) => s, error: (s: string) => s, accent: (s: string) => s, dim: (s: string) => s } as any;
    const result = tool.renderResult({
      details: {
        checks: [
          { name: 'lint', success: false, exitCode: 1, stderr: 'error' }
        ],
        overallSuccess: false
      }
    }, { expanded: false, isPartial: false }, theme);
    expect(result).toBeDefined();
  });

  test('execute calls onUpdate for each check start', async () => {
    api.exec.mockImplementation(async () => ({ stdout: '', stderr: '', code: 0 }));
    const onUpdate = jest.fn();
    const ctx = createMockContext();
    await tool.execute('1', {}, undefined, onUpdate, ctx);
    // onUpdate should have been called 4 times (for each default check)
    expect(onUpdate).toHaveBeenCalledTimes(4);
    // Each call should have { type: 'progress', check: <name>, status: 'running' }
    const calls = onUpdate.mock.calls as any[][];
    expect(calls[0][0]).toEqual(expect.objectContaining({ type: 'progress', status: 'running' }));
    expect(calls[0][0].check).toBe('lint');
    expect(calls[1][0].check).toBe('typecheck');
    expect(calls[2][0].check).toBe('test');
    expect(calls[3][0].check).toBe('build');
  });
});
