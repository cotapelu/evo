import { jest } from '@jest/globals';
import { registerBenchmarkExtension } from '../benchmark-extension.js';

function createMockApi() {
  const api: any = { registerTool: jest.fn() };
  return api;
}

function createMockContext() {
  return {
    cwd: process.cwd(),
    api: {
      getAllTools: jest.fn(() => []),
      exec: jest.fn(() => Promise.resolve({ code: 0, stdout: '', stderr: '' })),
    },
    sdkServices: {
      resourceLoader: { getAgentsFiles: jest.fn(() => Promise.resolve({ agentsFiles: [] })) },
      sessionManager: { getSessionInfo: jest.fn(() => Promise.resolve({ session_id: 'test', total_entries: 0 })) },
    },
  } as any;
}

describe('Benchmark Extension', () => {
  let api: any;
  let tool: any;

  beforeEach(() => {
    api = createMockApi();
    registerBenchmarkExtension(api);
    tool = api.registerTool.mock.calls[0][0];
  });

  test('tool metadata', () => {
    expect(tool.name).toBe('bench.run');
    expect(tool.label).toBe('Bench: Run');
    expect(tool.description).toContain('performance');
  });

  test('execute returns a table of measurements', async () => {
    const ctx = createMockContext();
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    const text = result.content[0].text;
    expect(text).toContain('Operation');
    expect(result.details.results.length).toBeGreaterThan(0);
  });
});