import { jest } from '@jest/globals';
import { registerTodosTool } from '../todos-tool.js';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

function createMockApi() {
  const handlers: Record<string, Function[]> = {};
  const api: any = {
    on: jest.fn((event: string, handler: Function) => {
      handlers[event] = handlers[event] || [];
      handlers[event].push(handler);
    }),
    appendEntry: jest.fn(),
    registerTool: jest.fn((tool: any) => { api.registeredTool = tool; }),
    getHandlers: () => handlers,
  };
  return api;
}

function createMockContext(custom?: any): ExtensionContext {
  return {
    cwd: process.cwd(),
    sessionManager: {
      getBranch: jest.fn(() => []),
    },
    ...custom,
  } as any;
}

describe('Todos Tool – Notes and Details', () => {
  let api: any;
  let tool: any;
  const toolCallId = 'test-call';

  beforeEach(async () => {
    jest.resetModules();
    api = createMockApi();
    const mod = await import('../todos-tool.js');
    mod.registerTodosTool(api);
    tool = api.registeredTool;
    expect(tool).toBeDefined();
  });

  test('add_phase with tasks including notes and details preserves them', async () => {
    const ctx = createMockContext();
    await tool.execute(toolCallId, {
      add_phase: { name: 'p', tasks: [{ content: 't', notes: 'n', details: 'd' }] }
    }, undefined, undefined, ctx);
    const list: any = await tool.execute(toolCallId, { list: {} }, undefined, undefined, ctx);
    const task = list.details.phases[0].tasks[0];
    expect(task.notes).toBe('n');
    expect(task.details).toBe('d');
  });

  test('add_task can include notes and details', async () => {
    const ctx = createMockContext();
    await tool.execute(toolCallId, { add_phase: { name: 'p' } }, undefined, undefined, ctx);
    await tool.execute(toolCallId, {
      add_task: { phase: 'p', content: 't', notes: 'my note', details: 'my details' }
    }, undefined, undefined, ctx);
    const list: any = await tool.execute(toolCallId, { list: {} }, undefined, undefined, ctx);
    const task = list.details.phases[0].tasks[0];
    expect(task.notes).toBe('my note');
    expect(task.details).toBe('my details');
  });

  test('update can modify notes and details', async () => {
    const ctx = createMockContext();
    await tool.execute(toolCallId, { add_phase: { name: 'p', tasks: [{ content: 't', notes: 'old', details: 'old' }] } }, undefined, undefined, ctx);
    const list1: any = await tool.execute(toolCallId, { list: {} }, undefined, undefined, ctx);
    const taskId = list1.details.phases[0].tasks[0].id;
    await tool.execute(toolCallId, {
      update: { id: taskId, notes: 'new note', details: 'new details' }
    }, undefined, undefined, ctx);
    const list2: any = await tool.execute(toolCallId, { list: {} }, undefined, undefined, ctx);
    const task = list2.details.phases[0].tasks[0];
    expect(task.notes).toBe('new note');
    expect(task.details).toBe('new details');
  });
});
