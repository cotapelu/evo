import { jest } from '@jest/globals';

// Create jest mock functions before mocking the module
const mkdirMock = jest.fn().mockResolvedValue(undefined);
const appendFileMock = jest.fn().mockResolvedValue(undefined);

// Mock fs/promises module
jest.unstable_mockModule('node:fs/promises', () => ({
  mkdir: mkdirMock,
  appendFile: appendFileMock,
}));

const { default: metricsCollector } = await import('../metrics-collector.js');
import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';

// Helper to create a mock API with registerTool tracking
function createMockApi() {
  const registeredTools: ToolDefinition<any, any>[] = [];
  const api: any = {
    registerTool: (tool: ToolDefinition<any, any>) => {
      registeredTools.push(tool);
    },
    getRegisteredTools: () => registeredTools,
  };
  return api;
}

// Helper to create a simple tool with configurable behavior
function createSimpleTool(name: string, behavior: 'success' | 'throw' | 'async' = 'success', delay = 0) {
  const tool: ToolDefinition<any, any> = {
    name,
    label: name,
    description: `Test tool ${name}`,
    parameters: {},
    async execute(toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any) {
      if (behavior === 'throw') {
        throw new Error('Tool error');
      }
      if (behavior === 'async' && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      return { content: [{ type: 'text', text: `Result from ${name}` }], isError: false };
    },
  };
  return tool;
}

describe('Metrics Collector', () => {
  let api: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mkdirMock.mockClear();
    appendFileMock.mockClear();
    mkdirMock.mockResolvedValue(undefined);
    appendFileMock.mockResolvedValue(undefined);
  });

  test('should wrap api.registerTool', () => {
    api = createMockApi();
    const originalRegisterTool = api.registerTool;
    metricsCollector(api);
    expect(api.registerTool).not.toBe(originalRegisterTool);
  });

  test('should preserve original tool behavior on success', async () => {
    api = createMockApi();
    metricsCollector(api);
    const tool = createSimpleTool('success-tool', 'success');
    api.registerTool(tool);
    const wrappedTool = api.getRegisteredTools()[0];
    const ctx = { cwd: '/test/project' };
    const result = await wrappedTool.execute('1', {}, undefined, undefined, ctx);
    expect(result).toEqual({ content: [{ type: 'text', text: 'Result from success-tool' }], isError: false });
  });

  test('should record metric on success and attempt file write', async () => {
    api = createMockApi();
    metricsCollector(api);
    const tool = createSimpleTool('success-tool', 'success');
    api.registerTool(tool);
    const ctx = { cwd: '/test/project' };
    await api.getRegisteredTools()[0].execute('1', {}, undefined, undefined, ctx);
    // Flush microtasks (fire-and-forget)
    await Promise.resolve();
    expect(mkdirMock).toHaveBeenCalledWith('/test/project/.pi', { recursive: true });
    const appendCalls = appendFileMock.mock.calls;
    expect(appendCalls.length).toBeGreaterThan(0);
    const lastArg = appendCalls[appendCalls.length - 1][1];
    const metric = JSON.parse(lastArg.split('\n')[0]);
    expect(metric).toMatchObject({
      toolName: 'success-tool',
      success: true,
      duration: expect.any(Number),
      timestamp: expect.any(Number),
    });
  });

  test('should record error metric and rethrow on failure', async () => {
    api = createMockApi();
    metricsCollector(api);
    const tool = createSimpleTool('fail-tool', 'throw');
    api.registerTool(tool);
    const ctx = { cwd: '/test/project' };
    await expect(api.getRegisteredTools()[0].execute('1', {}, undefined, undefined, ctx))
      .rejects.toThrow('Tool error');
    await Promise.resolve();
    expect(mkdirMock).toHaveBeenCalledWith('/test/project/.pi', { recursive: true });
    const lastArg = appendFileMock.mock.calls[0][1];
    const metric = JSON.parse(lastArg.split('\n')[0]);
    expect(metric).toMatchObject({
      toolName: 'fail-tool',
      success: false,
      error: 'Tool error',
    });
  });

  test('should ignore file write errors', async () => {
    api = createMockApi();
    appendFileMock.mockRejectedValue(new Error('disk full'));
    metricsCollector(api);
    const tool = createSimpleTool('test-tool', 'success');
    api.registerTool(tool);
    const ctx = { cwd: '/test/project' };
    const result = await api.getRegisteredTools()[0].execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    await Promise.resolve();
    expect(appendFileMock).toHaveBeenCalled();
  });

  test('should handle multiple tool registrations', async () => {
    api = createMockApi();
    metricsCollector(api);
    api.registerTool(createSimpleTool('tool-a', 'success', 10));
    api.registerTool(createSimpleTool('tool-b', 'success', 5));
    const ctx = { cwd: '/test/project' };
    await api.getRegisteredTools()[0].execute('1', {}, undefined, undefined, ctx);
    await api.getRegisteredTools()[1].execute('2', {}, undefined, undefined, ctx);
    await Promise.resolve();
    const calls = appendFileMock.mock.calls;
    const toolNames = calls.map(call => {
      const metric = JSON.parse(call[1].split('\n')[0]);
      return metric.toolName;
    });
    expect(toolNames).toContain('tool-a');
    expect(toolNames).toContain('tool-b');
  });

  test('should include accurate duration', async () => {
    api = createMockApi();
    metricsCollector(api);
    const tool = createSimpleTool('slow-tool', 'async', 60);
    api.registerTool(tool);
    const ctx = { cwd: '/test/project' };
    await api.getRegisteredTools()[0].execute('1', {}, undefined, undefined, ctx);
    await Promise.resolve();
    const lastArg = appendFileMock.mock.calls[0][1];
    const metric = JSON.parse(lastArg.split('\n')[0]);
    expect(metric.duration).toBeGreaterThanOrEqual(50);
    expect(metric.duration).toBeLessThan(200);
  });
});
