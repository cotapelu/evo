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

describe('Todos Tool – Batch Update', () => {
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

  test('update with ids array updates multiple tasks', async () => {
    const ctx = createMockContext();
    // Create phase with two tasks in one call
    await tool.execute(toolCallId, {
      add_phase: { name: 'BatchPhase', tasks: [{ content: 'Task A' }, { content: 'Task B' }] }
    }, undefined, undefined, ctx);

    // Get task IDs from list
    const listRes1: any = await tool.execute(toolCallId, { list: {} }, undefined, undefined, ctx);
    const phase = listRes1.details.phases.find((p: any) => p.name === 'BatchPhase');
    expect(phase).toBeDefined();
    const taskIds = phase.tasks.map((t: any) => t.id);
    expect(taskIds.length).toBe(2);

    // Batch update both tasks to completed
    const batchRes: any = await tool.execute(toolCallId, {
      update: { ids: taskIds, status: 'completed' }
    }, undefined, undefined, ctx);

    expect(batchRes.isError).toBe(false);

    // Verify via list
    const listRes2: any = await tool.execute(toolCallId, { list: {} }, undefined, undefined, ctx);
    const phase2 = listRes2.details.phases.find((p: any) => p.name === 'BatchPhase');
    expect(phase2).toBeDefined();
    expect(phase2.tasks[0].status).toBe('completed');
    expect(phase2.tasks[1].status).toBe('completed');
  });

  test('update: batch with all non-existent ids returns error', async () => {
    const ctx = createMockContext();
    await tool.execute(toolCallId, { add_phase: { name: 'p' } }, undefined, undefined, ctx);
    const batchRes: any = await tool.execute(toolCallId, {
      update: { ids: ['ghost1', 'ghost2'], status: 'completed' }
    }, undefined, undefined, ctx);
    expect(batchRes.isError).toBe(true);
    expect(batchRes.content[0].text).toContain('No valid tasks');
  });
});
