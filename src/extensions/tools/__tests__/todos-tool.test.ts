import { jest } from '@jest/globals';
import { registerTodosTool } from '../todos-tool.js';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync, promises as fs } from 'fs';
import { join } from 'path';

// Mock API
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
    sessionManager: {
      getBranch: jest.fn(() => []),
    },
    ...custom,
  } as any;
}

describe('Todos Tool – Isolation & Concurrency', () => {
  let api: any;
  let tool: any;
  let todosDir: string;

  beforeEach(async () => {
    jest.resetModules();
    api = createMockApi();
    const mod = await import('../todos-tool.js');
    mod.registerTodosTool(api);
    tool = api.registeredTool;
    expect(tool).toBeDefined();
    expect(tool.name).toBe('todos');

    todosDir = join(process.cwd(), '.pi', 'agent');
    mkdirSync(todosDir, { recursive: true });
    try { rmSync(join(todosDir, 'todos.json')); } catch {}
  });

  afterEach(async () => {
    try { await fs.rm(join(todosDir, 'todos.json')); } catch {}
    try { await fs.rm(join(todosDir, 'todos.json.bak')); } catch {}
    try { await fs.rm(todosDir, { recursive: true, force: true }); } catch {}
  });

  test('add_phase: creates phase with tasks', async () => {
    const ctx = createMockContext();
    const result = await tool.execute('1', { add_phase: { name: 'Phase 1', tasks: [{ content: 'Task 1' }] } }, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    const phases = result.details.phases;
    expect(phases.length).toBe(1);
    expect(phases[0].tasks.length).toBe(1);
    expect(phases[0].tasks[0].content).toBe('Task 1');
  });

  test('add_task: adds task to phase by ID', async () => {
    const ctx = createMockContext();
    // Create phase with empty tasks
    await tool.execute('1', { add_phase: { name: 'Phase 1', tasks: [] } }, undefined, undefined, ctx);
    // Get phases list to retrieve phase ID
    const list1 = await tool.execute('2', { list: {} }, undefined, undefined, ctx);
    const phaseId = list1.details.phases[0].id;

    // Add task
    const addResult = await tool.execute('3', { add_task: { phase: phaseId, content: 'New task' } }, undefined, undefined, ctx);
    expect(addResult.isError).toBe(false);

    // Verify
    const list2 = await tool.execute('4', { list: {} }, undefined, undefined, ctx);
    expect(list2.details.phases[0].tasks.length).toBe(1);
    expect(list2.details.phases[0].tasks[0].content).toBe('New task');
  });

  test('update: modifies task status', async () => {
    const ctx = createMockContext();
    await tool.execute('1', { add_phase: { name: 'Phase 1', tasks: [{ content: 'Task 1' }] } }, undefined, undefined, ctx);
    const list1 = await tool.execute('2', { list: {} }, undefined, undefined, ctx);
    const taskId = list1.details.phases[0].tasks[0].id;

    await tool.execute('3', { update: { id: taskId, status: 'in_progress' } }, undefined, undefined, ctx);

    const list2 = await tool.execute('4', { list: {} }, undefined, undefined, ctx);
    expect(list2.details.phases[0].tasks[0].status).toBe('in_progress');
  });

  test('remove_task: deletes task', async () => {
    const ctx = createMockContext();
    await tool.execute('1', { add_phase: { name: 'Phase 1', tasks: [{ content: 'Task 1' }, { content: 'Task 2' }] } }, undefined, undefined, ctx);
    const list1 = await tool.execute('2', { list: {} }, undefined, undefined, ctx);
    const taskId = list1.details.phases[0].tasks[1].id; // Task 2

    await tool.execute('3', { remove_task: { id: taskId } }, undefined, undefined, ctx);

    const list2 = await tool.execute('4', { list: {} }, undefined, undefined, ctx);
    expect(list2.details.phases[0].tasks.length).toBe(1);
  });

  test('delete: removes entire phase', async () => {
    const ctx = createMockContext();
    await tool.execute('1', { add_phase: { name: 'Phase 1', tasks: [{ content: 'Task 1' }] } }, undefined, undefined, ctx);
    const list1 = await tool.execute('2', { list: {} }, undefined, undefined, ctx);
    const phaseId = list1.details.phases[0].id;

    await tool.execute('3', { delete: { phase: phaseId } } as any, undefined, undefined, ctx);

    const list2 = await tool.execute('4', { list: {} }, undefined, undefined, ctx);
    expect(list2.details.phases.length).toBe(0);
  });

  test('list: returns phases and tasks', async () => {
    const ctx = createMockContext();
    await tool.execute('1', { add_phase: { name: 'Phase 1', tasks: [{ content: 'Task 1' }] } }, undefined, undefined, ctx);
    const result = await tool.execute('2', { list: {} }, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    const phases = result.details.phases;
    expect(phases.length).toBe(1);
    expect(phases[0].tasks.length).toBe(1);
    expect(phases[0].tasks[0].content).toBe('Task 1');
  });

  test('sessions isolated: two contexts do not share state', async () => {
    const ctx1 = createMockContext();
    const ctx2 = createMockContext();

    await tool.execute('1', { add_phase: { name: 'Phase 1', tasks: [{ content: 'Task 1' }] } }, undefined, undefined, ctx1);

    const list2 = await tool.execute('2', { list: {} }, undefined, undefined, ctx2);
    expect(list2.details.phases.length).toBe(0);
  });

  test('auto_normalize: only one in_progress task per phase (keeps first, demotes later)', async () => {
    const ctx = createMockContext();
    await tool.execute('1', { add_phase: { name: 'Phase 1', tasks: [
      { content: 'Task 1', status: 'pending' },
      { content: 'Task 2', status: 'pending' }
    ] } }, undefined, undefined, ctx);

    // Get task IDs
    const list1 = await tool.execute('2', { list: {} }, undefined, undefined, ctx);
    const tasks = list1.details.phases[0].tasks;
    const task1Id = tasks[0].id;
    const task2Id = tasks[1].id;

    // Mark first task in_progress
    await tool.execute('3', { update: { id: task1Id, status: 'in_progress' } }, undefined, undefined, ctx);
    // Mark second task in_progress – should auto-set first stays in_progress, second becomes pending
    await tool.execute('4', { update: { id: task2Id, status: 'in_progress' } }, undefined, undefined, ctx);

    const list2 = await tool.execute('5', { list: {} }, undefined, undefined, ctx);
    const finalTasks = list2.details.phases[0].tasks;
    const t1 = finalTasks.find((t: any) => t.id === task1Id);
    const t2 = finalTasks.find((t: any) => t.id === task2Id);
    // Current implementation: first remains in_progress, second becomes pending
    expect(t1.status).toBe('in_progress');
    expect(t2.status).toBe('pending');
  });

  test('file persistence: changes survive reload', async () => {
    const ctx1 = createMockContext();
    await tool.execute('1', { add_phase: { name: 'Phase 1', tasks: [{ content: 'Task 1' }] } }, undefined, undefined, ctx1);

    // Simulate new session: load from file
    const ctx2 = createMockContext();
    // session_start handler auto loads
    const sessionStartHandlers = api.getHandlers()['session_start'];
    expect(sessionStartHandlers.length).toBeGreaterThan(0);
    await sessionStartHandlers[0](null, ctx2);

    const result = await tool.execute('2', { list: {} }, undefined, undefined, ctx2);
    expect(result.details.phases.length).toBe(1);
    expect(result.details.phases[0].tasks[0].content).toBe('Task 1');
  });

  test('invalid JSON returns error', async () => {
    const ctx = createMockContext();
    const result = await tool.execute('1', '{bad}', undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error');
  });

  test('missing operation returns error (not silent list)', async () => {
    const ctx = createMockContext();
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
  });
});
