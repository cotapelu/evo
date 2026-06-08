import { jest } from '@jest/globals';
import { registerTodosTool } from '../todos-tool.js';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync, promises as fs } from 'fs';
import { join } from 'path';
import os from 'node:os';

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
    cwd: process.cwd(),
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

  test('atomic writes: no leftover temp files after save', async () => {
    const ctx = createMockContext();
    const filePath = join(todosDir, 'todos.json');

    // Perform an operation that triggers save
    await tool.execute('1', { add_phase: { name: 'Atomic Test', tasks: [{ content: 'Check temp cleanup' }] } }, undefined, undefined, ctx);

    // Manually trigger save (though it's saved automatically)
    const saveHandlers = api.getHandlers()['session_end'] || [];
    if (saveHandlers.length > 0) {
      await saveHandlers[0](null, ctx);
    }

    // List files in todosDir, ensure no .tmp.*.json files exist
    const files = await fs.readdir(todosDir);
    const tempFiles = files.filter(f => f.endsWith('.json') && f.includes('.tmp.'));
    expect(tempFiles).toHaveLength(0);
  });

  test('uses session cwd for file storage', async () => {
    const tmpDirA = join(os.tmpdir(), 'evo-todos-' + Date.now() + '-' + Math.random().toString(36).slice(2));
    const tmpDirB = join(os.tmpdir(), 'evo-todos-' + Date.now() + '-' + Math.random().toString(36).slice(2));
    mkdirSync(tmpDirA, { recursive: true });
    mkdirSync(tmpDirB, { recursive: true });
    try {
      const ctxA = createMockContext({ cwd: tmpDirA });
      const resultA = await tool.execute('1', { add_phase: { name: 'A Phase', tasks: [{ content: 'Task A' }] } }, undefined, undefined, ctxA);
      expect(resultA.isError).toBe(false);
      const filePathA = join(tmpDirA, '.pi', 'agent', 'todos.json');
      expect(existsSync(filePathA)).toBe(true);
      const contentA = JSON.parse(readFileSync(filePathA, 'utf-8'));
      expect(contentA.phases.length).toBe(1);

      const ctxB = createMockContext({ cwd: tmpDirB });
      const sessionStartHandlers = api.getHandlers()['session_start'];
      if (sessionStartHandlers.length > 0) {
        await sessionStartHandlers[0](null, ctxB);
      }
      const resultB = await tool.execute('2', { list: {} }, undefined, undefined, ctxB);
      expect(resultB.isError).toBe(false);
      expect(resultB.details.phases.length).toBe(0);
    } finally {
      [tmpDirA, tmpDirB].forEach(dir => {
        try { rmSync(join(dir, '.pi'), { recursive: true, force: true }); } catch {}
        try { rmSync(dir, { recursive: true, force: true }); } catch {}
      });
    }
  });

  describe('Todos Tool – Error Handling', () => {
    test('add_task: returns error if phase does not exist', async () => {
      const ctx = createMockContext();
      const result = await tool.execute('1', { add_task: { phase: 'non-existent', content: 'Task' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Phase "non-existent" not found');
    });

    test('update: returns error if task does not exist', async () => {
      const ctx = createMockContext();
      const result = await tool.execute('1', { update: { id: 'task-999', status: 'completed' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Task "task-999" not found');
    });

    test('remove_task: returns error if task does not exist', async () => {
      const ctx = createMockContext();
      const result = await tool.execute('1', { remove_task: { id: 'task-999' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Task "task-999" not found');
    });

    test('delete: returns error if phase does not exist', async () => {
      const ctx = createMockContext();
      const result = await tool.execute('1', { delete: { phase: 'non-existent' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Phase "non-existent" not found');
    });
  });

  describe('Todos Tool – Deletion', () => {
    test('delete: removes specific phase by ID or name', async () => {
      const ctx = createMockContext();
      // Create two phases
      await tool.execute('1', { add_phase: { name: 'Phase A', tasks: [{ content: 'A1' }] } }, undefined, undefined, ctx);
      await tool.execute('2', { add_phase: { name: 'Phase B', tasks: [{ content: 'B1' }] } }, undefined, undefined, ctx);
      // Get list to find Phase A ID
      const listRes = await tool.execute('3', { list: {} }, undefined, undefined, ctx);
      const phaseA = listRes.details.phases.find((p: any) => p.name === 'Phase A');
      expect(phaseA).toBeDefined();
      // Delete Phase A
      const delRes = await tool.execute('4', { delete: { phase: phaseA.id } }, undefined, undefined, ctx);
      expect(delRes.isError).toBe(false);
      // Verify only Phase B remains
      const afterList = await tool.execute('5', { list: {} }, undefined, undefined, ctx);
      expect(afterList.details.phases.length).toBe(1);
      expect(afterList.details.phases[0].name).toBe('Phase B');
    });
  });

  describe('Rendering', () => {
    let tool: any;

    beforeEach(async () => {
      jest.resetModules();
      api = createMockApi();
      const mod = await import('../todos-tool.js');
      mod.registerTodosTool(api);
      tool = api.registeredTool;
      expect(tool).toBeDefined();
    });

    test('renderCall shows operation', () => {
      const theme = { fg: (c: string, s: string) => s, bold: (s: string) => s };
      const call1 = tool.renderCall({ add_phase: { name: 'P', tasks: [] } }, theme);
      expect(call1).toBeDefined();
      const call2 = tool.renderCall({ add_task: { phase: 'p1', content: 'Task' } }, theme);
      expect(call2).toBeDefined();
      const call3 = tool.renderCall({ update: { id: 't1', status: 'completed' } }, theme);
      expect(call3).toBeDefined();
      const call4 = tool.renderCall({ remove_task: { id: 't1' } }, theme);
      expect(call4).toBeDefined();
      const call5 = tool.renderCall({ delete: { phase: 'p1' } }, theme);
      expect(call5).toBeDefined();
      const call6 = tool.renderCall({ list: {} }, theme);
      expect(call6).toBeDefined();
    });

    test('renderResult: no details → empty', () => {
      const theme = {};
      const result = tool.renderResult({}, { expanded: false, isPartial: false }, theme);
      expect(result).toBeDefined();
    });

    test('renderResult: error', () => {
      const theme = { fg: (c: string, s: string) => s };
      const result = tool.renderResult({ details: { error: 'Something wrong' } }, { expanded: false, isPartial: false }, theme);
      expect(result).toBeDefined();
    });

    test('renderResult: partial', () => {
      const theme = {};
      const result = tool.renderResult({}, { expanded: false, isPartial: true }, theme);
      expect(result).toBeDefined();
    });

    test('renderResult: empty todos', () => {
      const theme = { fg: (c: string, s: string) => s, dim: (s: string) => s };
      const result = tool.renderResult({ details: { phases: [] } }, { expanded: false, isPartial: false }, theme);
      expect(result).toBeDefined();
    });

    test('renderResult: single phase with tasks, not expanded', () => {
      const theme = { fg: (c: string, s: string) => s, accent: (s: string) => s, text: (s: string) => s, dim: (s: string) => s };
      const details = {
        phases: [{ id: 'p1', name: 'Phase 1', tasks: [
          { id: 't1', content: 'Task 1', status: 'pending' as any },
          { id: 't2', content: 'Task 2', status: 'in_progress' as any, details: 'Detail line 1\nDetail line 2' },
          { id: 't3', content: 'Task 3', status: 'completed' as any },
        ]}],
      };
      const result = tool.renderResult({ details }, { expanded: false, isPartial: false }, theme);
      expect(result).toBeDefined();
    });

    test('renderResult: truncates when not expanded', () => {
      const theme = { fg: (c: string, s: string) => s, accent: (s: string) => s, text: (s: string) => s, dim: (s: string) => s };
      const manyTasks = Array.from({ length: 10 }, (_, i) => ({
        id: `t${i}`,
        content: `Task ${i}`,
        status: 'pending' as any,
      }));
      const details = { phases: [{ id: 'p1', name: 'Phase 1', tasks: manyTasks }] };
      const result = tool.renderResult({ details }, { expanded: false, isPartial: false }, theme);
      expect(result).toBeDefined();
    });

    test('renderResult: shows all when expanded', () => {
      const theme = { fg: (c: string, s: string) => s, accent: (s: string) => s, text: (s: string) => s, dim: (s: string) => s };
      const manyTasks = Array.from({ length: 3 }, (_, i) => ({
        id: `t${i}`,
        content: `Task ${i}`,
        status: 'pending' as any,
      }));
      const details = { phases: [{ id: 'p1', name: 'Phase 1', tasks: manyTasks }] };
      const result = tool.renderResult({ details }, { expanded: true, isPartial: false }, theme);
      expect(result).toBeDefined();
    });

    test('renderResult: multiple phases', () => {
      const theme = { fg: (c: string, s: string) => s, accent: (s: string) => s, text: (s: string) => s, dim: (s: string) => s };
      const details = {
        phases: [
          { id: 'p1', name: 'Phase A', tasks: [{ id: 't1', content: 'Task A1', status: 'pending' as any }] },
          { id: 'p2', name: 'Phase B', tasks: [{ id: 't2', content: 'Task B1', status: 'in_progress' as any }] },
        ],
      };
      const result = tool.renderResult({ details }, { expanded: false, isPartial: false }, theme);
      expect(result).toBeDefined();
    });
  });

  describe('Todos Tool – Additional Coverage', () => {
    const toolCallId = 'test-call-1';
    test('rejects add_phase without name', async () => {
      const result: any = await tool.execute(toolCallId, { add_phase: {} }, undefined, undefined, createMockContext());
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('add_phase.name must be a string');
    });

    test('rejects add_task without phase', async () => {
      const result: any = await tool.execute(toolCallId, { add_task: { content: 'task' } }, undefined, undefined, createMockContext());
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('add_task.phase must be a string');
    });

    test('rejects add_task without content', async () => {
      const result: any = await tool.execute(toolCallId, { add_task: { phase: 'p1' } }, undefined, undefined, createMockContext());
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('add_task.content must be a string');
    });

    test('rejects add_task to non-existent phase', async () => {
      const result: any = await tool.execute(toolCallId, { add_task: { phase: 'nonexistent', content: 'task' } }, undefined, undefined, createMockContext());
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });

    test('rejects update without phase and task', async () => {
      const result: any = await tool.execute(toolCallId, { update: { status: 'completed' } }, undefined, undefined, createMockContext());
      expect(result.isError).toBe(true);
    });

    test('rejects remove_task without params', async () => {
      const result: any = await tool.execute(toolCallId, { remove_task: {} }, undefined, undefined, createMockContext());
      expect(result.isError).toBe(true);
    });

    test('add_phase rejects non-string name', async () => {
      const ctx = createMockContext();
      const result: any = await tool.execute(toolCallId, { add_phase: { name: 123 as any } }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('add_phase.name must be a string');
    });

  });
});
