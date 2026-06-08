import { jest } from '@jest/globals';
function createMockApi() {
    const execMock = jest.fn().mockImplementation(async () => ({ stdout: '', stderr: '', code: 0 }));
    const api = {
        on: jest.fn(),
        registerTool: jest.fn((tool) => { api.registeredTool = tool; }),
        exec: execMock,
    };
    return api;
}
function createMockContext() {
    return {
        sessionManager: { getCwd: jest.fn(() => '/workspace') },
        cwd: '/workspace',
        mode: 'tui',
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
            onTerminalInput: jest.fn(() => () => { }),
            setStatus: jest.fn(),
            setWorkingMessage: jest.fn(),
            setWorkingVisible: jest.fn(),
            setWorkingIndicator: jest.fn(),
            setHiddenThinkingLabel: jest.fn(),
            setWidget: jest.fn(),
        },
    };
}
describe('Test Runner Tool', () => {
    let api;
    let tool;
    beforeEach(async () => {
        jest.resetModules();
        api = createMockApi();
        const mod = await import('../test-runner.js');
        mod.registerTestRunnerTool(api);
        tool = api.registeredTool;
        expect(tool).toBeDefined();
        expect(tool.name).toBe('test');
    });
    test('run: executes npm test with optional pattern', async () => {
        api.exec.mockResolvedValue({ stdout: 'PASS 1', stderr: '', code: 0 });
        const ctx = createMockContext();
        const result = await tool.execute('1', { pattern: 'utils' }, undefined, undefined, ctx);
        expect(api.exec).toHaveBeenCalledWith('npm', ['test', '--', 'utils'], expect.objectContaining({ cwd: '/workspace' }));
        expect(result.isError).toBe(false);
        expect(result.content[0].text).toContain('Tests completed');
        expect(result.details?.exitCode).toBe(0);
    });
    test('run: without pattern runs all tests', async () => {
        api.exec.mockResolvedValue({ stdout: 'All tests passed', stderr: '', code: 0 });
        const ctx = createMockContext();
        const result = await tool.execute('1', {}, undefined, undefined, ctx);
        expect(api.exec).toHaveBeenCalledWith('npm', ['test'], expect.objectContaining({ cwd: '/workspace' }));
        expect(result.isError).toBe(false);
    });
    test('run: non-zero exit code sets isError true', async () => {
        api.exec.mockResolvedValue({ stdout: 'FAIL 1', stderr: 'error', code: 1 });
        const ctx = createMockContext();
        const result = await tool.execute('1', {}, undefined, undefined, ctx);
        expect(result.isError).toBe(true);
        expect(result.details?.exitCode).toBe(1);
        expect(result.content[0].text).toContain('failed');
    });
    test('run: passes abort signal to exec options', async () => {
        const signal = new AbortController().signal;
        api.exec.mockResolvedValue({ stdout: '', stderr: '', code: 0 });
        const ctx = createMockContext();
        await tool.execute('1', {}, signal, undefined, ctx);
        expect(api.exec).toHaveBeenCalledWith(expect.any(String), expect.any(Array), expect.objectContaining({ signal, cwd: '/workspace' }));
    });
    test('run: handles exec rejection', async () => {
        api.exec.mockRejectedValue(new Error('spawn failed'));
        const ctx = createMockContext();
        const result = await tool.execute('1', {}, undefined, undefined, ctx);
        expect(result.isError).toBe(true);
        expect(result.details?.error).toBe('spawn failed');
    });
    test('run: with coverage flag adds --coverage', async () => {
        api.exec.mockResolvedValue({ stdout: '', stderr: '', code: 0 });
        const ctx = createMockContext();
        const result = await tool.execute('1', { coverage: true }, undefined, undefined, ctx);
        expect(api.exec).toHaveBeenCalledWith('npm', ['test', '--', '--coverage'], expect.objectContaining({ cwd: '/workspace' }));
        expect(result.isError).toBe(false);
    });
    test('run: with pattern and coverage', async () => {
        api.exec.mockResolvedValue({ stdout: '', stderr: '', code: 0 });
        const ctx = createMockContext();
        const result = await tool.execute('1', { pattern: 'utils', coverage: true }, undefined, undefined, ctx);
        expect(api.exec).toHaveBeenCalledWith('npm', ['test', '--', 'utils', '--coverage'], expect.objectContaining({ cwd: '/workspace' }));
        expect(result.isError).toBe(false);
    });
    test('run: invalid params type', async () => {
        // default mock already returns code 0
        const ctx = createMockContext();
        const result = await tool.execute('1', null, undefined, undefined, ctx);
        expect(result.isError).toBe(false);
        expect(api.exec).toHaveBeenCalledWith('npm', ['test'], expect.objectContaining({ cwd: '/workspace' }));
    });
    test('run: with coverage flag includes coverage field in details', async () => {
        api.exec.mockResolvedValue({ stdout: '', stderr: '', code: 0 });
        const ctx = createMockContext();
        const result = await tool.execute('1', { coverage: true }, undefined, undefined, ctx);
        expect(result.details).toHaveProperty('coverage');
        // coverage should be undefined since no coverage file exists
        expect(result.details.coverage).toBeUndefined();
    });
});
//# sourceMappingURL=test-runner.test.js.map