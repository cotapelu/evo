import { jest } from '@jest/globals';
import { createToolboxTool, registerToolboxTool, getAvailableTools, getToolInfo } from '../toolbox.js';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';

// Mock API
function createMockApi() {
  const handlers: Record<string, Function[]> = {};
  const api: any = {
    on: jest.fn((event: string, handler: Function) => {
      handlers[event] = handlers[event] || [];
      handlers[event].push(handler);
    }),
    registerTool: jest.fn((tool: any) => { (api as any).registeredTool = tool; }),
    getHandlers: () => handlers,
    exec: jest.fn(async () => ({ stdout: 'mocked output', stderr: '', code: 0, killed: false })),
  };
  return api;
}

function createMockContext(sessionManager?: any, session?: any, exec?: jest.Mock): ExtensionContext {
  return {
    sessionManager: sessionManager || {
      getBranch: jest.fn(() => []),
    },
    session: session,
    exec: exec,
  } as any;
}

describe('Toolbox Tool', () => {
  let api: any;
  let tool: any;

  beforeEach(() => {
    api = createMockApi();
    registerToolboxTool(api);
    tool = api.registeredTool;
    expect(tool).toBeDefined();
    expect(tool.name).toBe('toolbox');
  });

  describe('Tool Definition', () => {
    it('has correct name and description', () => {
      expect(tool.name).toBe('toolbox');
      expect(tool.description).toContain('Unified tool');
      expect(tool.description).toContain('shell operations');
      expect(tool.description).toContain('pure actions');
    });

    it('includes all expected tools in enum', () => {
      const toolEnum = tool.parameters.properties.tool.enum;
      // Shell tools
      expect(toolEnum).toContain('ls');
      expect(toolEnum).toContain('find');
      expect(toolEnum).toContain('grep');
      expect(toolEnum).toContain('read');
      expect(toolEnum).toContain('http');
      // Action tools
      expect(toolEnum).toContain('echo');
      expect(toolEnum).toContain('date');
      expect(toolEnum).toContain('uuid');
      expect(toolEnum).toContain('random');
      expect(toolEnum).toContain('calc');
      expect(toolEnum).toContain('system_info');
    });

    it('requires tool and args parameters', () => {
      expect(tool.parameters.required).toContain('tool');
      expect(tool.parameters.required).toContain('args');
    });
  });

  describe('Shell Tools Execution', () => {
    let ctx: any;

    beforeEach(() => {
      ctx = createMockContext({
        getBranch: jest.fn(() => []),
      }, { cwd: '/test/dir' }, api.exec);
    });

    test('ls: lists directory with default args', async () => {
      const result = await tool.execute('call', { tool: 'ls', args: {} }, undefined, undefined, ctx);
      expect(api.exec).toHaveBeenCalledWith('ls', ['-l'], { cwd: '/test/dir', signal: undefined });
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('mocked output');
    });

    test('ls: uses -la when all=true', async () => {
      const result = await tool.execute('call', { tool: 'ls', args: { all: true } }, undefined, undefined, ctx);
      expect(api.exec).toHaveBeenCalledWith('ls', ['-la'], { cwd: '/test/dir', signal: undefined });
    });

    test('ls: uses -lR when recursive=true', async () => {
      const result = await tool.execute('call', { tool: 'ls', args: { recursive: true } }, undefined, undefined, ctx);
      expect(api.exec).toHaveBeenCalledWith('ls', ['-lR'], { cwd: '/test/dir', signal: undefined });
    });

    test('ls: uses custom path', async () => {
      const result = await tool.execute('call', { tool: 'ls', args: { path: '/other' } }, undefined, undefined, ctx);
      expect(api.exec).toHaveBeenCalledWith('ls', ['-l', '/other'], { cwd: '/other', signal: undefined });
    });

    test('find: finds files by pattern', async () => {
      const result = await tool.execute('call', { tool: 'find', args: { pattern: '*.ts' } }, undefined, undefined, ctx);
      expect(api.exec).toHaveBeenCalledWith('find', ['/test/dir', '-name', '*.ts'], { cwd: '/test/dir', signal: undefined });
    });

    test('find: respects maxDepth', async () => {
      const result = await tool.execute('call', { tool: 'find', args: { pattern: '*.ts', maxDepth: 3 } }, undefined, undefined, ctx);
      expect(api.exec).toHaveBeenCalledWith('find', ['/test/dir', '-maxdepth', '3', '-name', '*.ts'], { cwd: '/test/dir', signal: undefined });
    });

    test('grep: searches recursively', async () => {
      const result = await tool.execute('call', { tool: 'grep', args: { pattern: 'test' } }, undefined, undefined, ctx);
      expect(api.exec).toHaveBeenCalledWith('grep', ['-r', 'test'], { cwd: '/test/dir', signal: undefined });
    });

    test('grep: respects include/exclude/ignoreCase', async () => {
      const result = await tool.execute('call', {
        tool: 'grep',
        args: { pattern: 'test', include: '*.ts', exclude: 'node_modules', ignoreCase: true }
      }, undefined, undefined, ctx);
      expect(api.exec).toHaveBeenCalledWith('grep', ['-i', '--include', '*.ts', '--exclude', 'node_modules', '-r', 'test'], { cwd: '/test/dir', signal: undefined });
    });

    test('read: reads file with cat', async () => {
      const result = await tool.execute('call', { tool: 'read', args: { path: 'file.txt' } }, undefined, undefined, ctx);
      expect(api.exec).toHaveBeenCalledWith('bash', ['-c', "cat 'file.txt'"], { cwd: '/test/dir', signal: undefined });
    });

    test('read: uses tail for offset', async () => {
      const result = await tool.execute('call', { tool: 'read', args: { path: 'file.txt', offset: 10 } }, undefined, undefined, ctx);
      expect(api.exec).toHaveBeenCalledWith('bash', ['-c', "cat 'file.txt' | tail -n +10"], { cwd: '/test/dir', signal: undefined });
    });

    test('read: uses head for limit', async () => {
      const result = await tool.execute('call', { tool: 'read', args: { path: 'file.txt', limit: 5 } }, undefined, undefined, ctx);
      expect(api.exec).toHaveBeenCalledWith('bash', ['-c', "cat 'file.txt' | head -n 5"], { cwd: '/test/dir', signal: undefined });
    });

    test('http: constructs curl command with method', async () => {
      const result = await tool.execute('call', {
        tool: 'http',
        args: { method: 'POST', url: 'https://api.example.com', body: { key: 'value' } }
      }, undefined, undefined, ctx);
      // Check that curl was called with -X POST
      expect(api.exec).toHaveBeenCalledWith(
        'curl',
        expect.arrayContaining(['-X', 'POST', expect.stringContaining('https://api.example.com')]),
        { cwd: '/test/dir', signal: undefined }
      );
    });

    test('http: includes headers', async () => {
      const result = await tool.execute('call', {
        tool: 'http',
        args: { url: 'https://test.com', headers: { 'Content-Type': 'application/json' } }
      }, undefined, undefined, ctx);
      expect(api.exec).toHaveBeenCalledWith(
        'curl',
        expect.arrayContaining(['-H', 'Content-Type: application/json']),
        { cwd: '/test/dir', signal: undefined }
      );
    });
  });

  describe('Action Tools Execution', () => {
    let ctx: any;

    beforeEach(() => {
      ctx = createMockContext({
        getBranch: jest.fn(() => []),
      });
      // Action tools don't need cwd
    });

    test('echo: returns message', async () => {
      const result = await tool.execute('call', { tool: 'echo', args: { message: 'Hello World' } }, undefined, undefined, ctx);
      expect(result.content[0].text).toBe('Echo: Hello World');
      expect(result.details).toBe('Hello World');
      expect(result.isError).toBe(false);
    });

    test('echo: throws without message', async () => {
      const result = await tool.execute('call', { tool: 'echo', args: {} }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing required parameter');
    });

    test('date: returns ISO and locale', async () => {
      const result = await tool.execute('call', { tool: 'date', args: {} }, undefined, undefined, ctx);
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('Current date/time:');
      expect(result.content[1].text).toContain('Human readable:');
      expect(result.details).toHaveProperty('iso');
      expect(result.details).toHaveProperty('locale');
    });

    test('uuid: generates valid UUID', async () => {
      const result = await tool.execute('call', { tool: 'uuid', args: {} }, undefined, undefined, ctx);
      expect(result.content[0].text).toContain('Generated UUID:');
      expect(result.details).toHaveProperty('uuid');
      // UUID v4 format
      expect(result.details.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    test('random: returns number in range', async () => {
      const result = await tool.execute('call', { tool: 'random', args: { min: 10, max: 20 } }, undefined, undefined, ctx);
      expect(result.content[0].text).toContain('Random number:');
      expect(result.details).toHaveProperty('value');
      expect(result.details.value).toBeGreaterThanOrEqual(10);
      expect(result.details.value).toBeLessThanOrEqual(20);
    });

    test('random: default range 0-100', async () => {
      const result = await tool.execute('call', { tool: 'random', args: {} }, undefined, undefined, ctx);
      expect(result.details.min).toBe(0);
      expect(result.details.max).toBe(100);
    });

    test('calc: evaluates expression', async () => {
      const result = await tool.execute('call', { tool: 'calc', args: { expression: '2 + 3 * 4' } }, undefined, undefined, ctx);
      expect(result.content[0].text).toBe('2 + 3 * 4 = 14');
      expect(result.details.result).toBe(14);
    });

    test('calc: rejects invalid expression', async () => {
      const result = await tool.execute('call', { tool: 'calc', args: { expression: '2 + alert(1)' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
    });

    test('system_info: returns system data', async () => {
      const result = await tool.execute('call', { tool: 'system_info', args: {} }, undefined, undefined, ctx);
      expect(result.details).toHaveProperty('platform');
      expect(result.details).toHaveProperty('arch');
      expect(result.details).toHaveProperty('nodeVersion');
      expect(result.details).toHaveProperty('cpuCores');
    });
  });

  describe('Error Handling', () => {
    let ctx: any;

    beforeEach(() => {
      ctx = createMockContext({
        getBranch: jest.fn(() => []),
      }, { cwd: '/test/dir' }, api.exec);
    });

    test('unknown tool returns error', async () => {
      const result = await tool.execute('call', { tool: 'nonexistent', args: {} }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown tool');
    });

    test('shell tool error propagates correctly', async () => {
      // Override exec to simulate error
      api.exec = jest.fn(async () => ({ stdout: '', stderr: 'command failed', code: 1, killed: false }));
      // Update ctx.exec to use new mock
      (ctx as any).exec = api.exec;
      const result = await tool.execute('call', { tool: 'ls', args: {} }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
    });
  });

  describe('Utility Functions', () => {
    it('getAvailableTools returns all tools', () => {
      const tools = getAvailableTools();
      expect(tools).toContain('ls');
      expect(tools).toContain('echo');
      expect(tools).toContain('http');
      expect(tools).toContain('calc');
    });

    it('getToolInfo returns correct type and schema', () => {
      const shellInfo = getToolInfo('ls');
      expect(shellInfo?.type).toBe('shell');
      expect(shellInfo?.schema).toBeDefined();

      const actionInfo = getToolInfo('echo');
      expect(actionInfo?.type).toBe('action');
      expect(actionInfo?.schema).toBeDefined();

      const unknownInfo = getToolInfo('unknown');
      expect(unknownInfo).toBeNull();
    });
  });

  describe('createToolboxTool factory', () => {
    it('creates a valid ToolDefinition', () => {
      const definition = createToolboxTool();
      expect(definition.name).toBe('toolbox');
      expect(definition.execute).toBeDefined();
      expect(definition.parameters).toBeDefined();
    });
  });
});
