import { jest } from '@jest/globals';
import defaultExtension from '../index.js';
import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';

function createMockApi(): any {
  const handlers: Record<string, Function[]> = {};
  const api: any = {
    on: jest.fn((event: string, handler: Function) => {
      handlers[event] = handlers[event] || [];
      handlers[event].push(handler);
    }),
    appendEntry: jest.fn(),
    registerTool: jest.fn((tool: ToolDefinition<any, any>) => {
      api.registeredTools = api.registeredTools || [];
      api.registeredTools.push(tool);
    }),
    registerProvider: jest.fn(),
    registerCommand: jest.fn(),
    registerShortcut: jest.fn(),
    registerMessageRenderer: jest.fn(),
    getHandlers: () => handlers,
    exec: jest.fn(),
    ui: { setHeader: jest.fn(), addAutocompleteProvider: jest.fn() },
  };
  return api;
}

describe('Default Extension (index)', () => {
  let api: any;

  beforeEach(() => {
    api = createMockApi();
  });

  test('registers all tools and extensions without throwing', () => {
    expect(() => defaultExtension(api)).not.toThrow();
  });

  test('registers multiple tools (at least 10 tools expected)', () => {
    defaultExtension(api);
    // The metrics collector wraps registerTool, but our mock still records tools in registeredTools
    const toolCount = api.registeredTools?.length || 0;
    expect(toolCount).toBeGreaterThanOrEqual(10);
  });

  test('registers specific expected tools (todos, memory, notes, etc.)', () => {
    defaultExtension(api);
    const toolNames = api.registeredTools?.map((t: ToolDefinition<any, any>) => t.name) || [];
    expect(toolNames).toContain('todos');
    expect(toolNames).toContain('memory');
    expect(toolNames).toContain('notes');
    expect(toolNames).toContain('tool-metrics');
    expect(toolNames).toContain('metrics');
    expect(toolNames).toContain('code-health');
    expect(toolNames).toContain('git');
  });

  test('registers kilo provider and metrics collector', () => {
    defaultExtension(api);
    expect(api.registerProvider).toHaveBeenCalledWith('kilo', expect.any(Object));
  });

  test('registers auto-continue extension and commands', () => {
    defaultExtension(api);
    // Check that 'gnpi' command is registered with a handler object
    const gnpiCalls = api.registerCommand.mock.calls.filter((c: any[]) => c[0] === 'gnpi');
    expect(gnpiCalls.length).toBeGreaterThan(0);
    expect(gnpiCalls[0][1]).toEqual(expect.objectContaining({ handler: expect.any(Function) }));
    // Event listeners for auto-continue
    expect(api.on).toHaveBeenCalledWith('agent_end', expect.any(Function));
    expect(api.on).toHaveBeenCalledWith('session_shutdown', expect.any(Function));
  });
});
