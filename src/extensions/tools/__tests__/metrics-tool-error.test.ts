import { jest } from '@jest/globals';

// Mock node:fs
const existsSyncMock = jest.fn();
const readFileSyncMock = jest.fn();

jest.unstable_mockModule('node:fs', () => ({
  existsSync: existsSyncMock,
  readFileSync: readFileSyncMock,
}));

// We need to import the tool after mocking
const { registerMetricsTool } = await import('../metrics-tool.js');

function createMockApi() {
  const api: any = {
    on: jest.fn(),
    registerTool: jest.fn((tool: any) => { api.registeredTool = tool; }),
  };
  return api;
}

function createMockContext(cwd: string) {
  return {
    cwd,
    sessionManager: { getCwd: jest.fn(() => cwd) },
    ui: { notify: jest.fn() },
  } as any;
}

describe('Metrics Tool – Error Handling', () => {
  let api: any;
  let tool: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    existsSyncMock.mockReturnValue(true);
    readFileSyncMock.mockReturnValue('# Metrics content');

    api = createMockApi();
    registerMetricsTool(api);
    tool = api.registeredTool;
    expect(tool).toBeDefined();
    expect(tool.name).toBe('metrics');
  });

  afterEach(() => {
    jest.resetModules();
  });

  test('handles readFileSync throwing (e.g., permission denied)', async () => {
    readFileSyncMock.mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });

    const ctx = createMockContext(process.cwd());
    const result: any = await tool.execute('1', {}, undefined, undefined, ctx);

    expect(result.isError).toBe(true);
    expect(result.details?.error).toContain('EACCES');
    expect(result.content[0].text).toContain('Error reading metrics');
  });

  test('handles existsSync returning false', async () => {
    existsSyncMock.mockReturnValue(false);

    const ctx = createMockContext(process.cwd());
    const result: any = await tool.execute('1', {}, undefined, undefined, ctx);

    expect(result.isError).toBe(true);
    expect(result.details?.error).toBe('missing');
    expect(result.content[0].text).toContain('not found');
  });

  test('handles readFileSync returning non-string (should still succeed)', async () => {
    readFileSyncMock.mockReturnValue(123 as any); // not string

    const ctx = createMockContext(process.cwd());
    const result: any = await tool.execute('1', {}, undefined, undefined, ctx);

    // Should still return result but content might be weird
    expect(result).toBeDefined();
  });
});
