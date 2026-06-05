import { jest } from '@jest/globals';
import { registerMetricsTool } from '../metrics-tool.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function createMockApi(overrides: any = {}) {
  const api: any = {
    on: jest.fn(),
    registerTool: jest.fn((tool: any) => { api.registeredTool = tool; }),
    exec: jest.fn(),
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

describe('Metrics Tool', () => {
  let api: any;
  let tool: any;

  beforeEach(async () => {
    jest.resetModules();
    api = createMockApi();
    const mod = await import('../metrics-tool.js');
    mod.registerMetricsTool(api);
    tool = api.registeredTool;
    expect(tool).toBeDefined();
    expect(tool.name).toBe('metrics');
  });

  test('reads and returns real metrics file content', async () => {
    const ctx = createMockContext({ cwd: process.cwd() });
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Agent Evolution Metrics');
    expect(result.details?.path).toContain('docs/AGENT_METRICS.md');
  });

  test('handles missing metrics file by using non-existent cwd', async () => {
    const ctx = createMockContext({ cwd: '/nonexistent-path-12345' });
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });
});
