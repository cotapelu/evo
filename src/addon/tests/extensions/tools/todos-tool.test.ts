import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// In-memory filesystem for node:fs mocks
const fsMap = new Map<string, string>();

// Mock @earendil-works/pi-tui Text
vi.mock('@earendil-works/pi-tui', () => ({
  Text: class Text {
    text: string;
    constructor(text: string, _x: number, _y: number) {
      this.text = text;
    }
  },
}));

// Mock node:fs
vi.mock('node:fs', () => {
  return {
    existsSync: (path: string) => fsMap.has(path),
    readFileSync: (path: string, encoding: string) => {
      if (!fsMap.has(path)) throw new Error(`File not found: ${path}`);
      return fsMap.get(path)!;
    },
    readFile: (path: string, options: any) => {
      return Promise.resolve(fsMap.has(path) ? fsMap.get(path)! : '');
    },
    writeFile: (path: string, data: string) => {
      return Promise.resolve(fsMap.set(path, data));
    },
    rename: (oldPath: string, newPath: string) => {
      if (!fsMap.has(oldPath)) throw new Error(`File not found: ${oldPath}`);
      fsMap.set(newPath, fsMap.get(oldPath)!);
      fsMap.delete(oldPath);
    },
    mkdir: (path: string, options: any) => {
      if (!fsMap.has(path)) fsMap.set(path, '');
    },
    promises: {
      mkdir: (path: any, options: any) => {
        if (!fsMap.has(path)) fsMap.set(path, '');
        return Promise.resolve();
      },
      readFile: (path: any, options: any) => {
        return Promise.resolve(fsMap.has(path) ? fsMap.get(path)! : '');
      },
      writeFile: (path: any, data: any) => {
        return Promise.resolve(fsMap.set(path, data));
      },
      rename: (old: any, newPath: any) => {
        if (!fsMap.has(old)) throw new Error(`File not found: ${old}`);
        fsMap.set(newPath, fsMap.get(old)!);
        fsMap.delete(old);
        return Promise.resolve();
      },
    },
  };
});

// Mock Mutex
vi.mock('../../../extensions/utils/mutex.js', () => ({
  Mutex: class {
    private locked = false;
    async lock() {
      if (this.locked) throw new Error('Mutex already locked');
      this.locked = true;
      const release = () => { this.locked = false; };
      return release;
    }
  },
}));

// Mock withFileMutationQueue
vi.mock('@earendil-works/pi-coding-agent', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    withFileMutationQueue: vi.fn(async (filePath: string, fn: () => Promise<void>) => {
      return fn();
    }),
  };
});

import {
  TodoState,
  applyOp,
  formatSummary,
  getLatestTodoPhasesFromEntries,
  createTodoTool,
  renderTodosCall,
  renderTodosResult,
} from '../../../extensions/tools/todos-tool.js';
import type { TodoPhase } from '../../../extensions/tools/todos-tool.js';

beforeEach(() => {
  fsMap.clear();
  vi.clearAllMocks();
});

// ================================
// TodoState Tests
// ================================

describe('TodoState', () => {
  let state: TodoState;
  const cwd = '/test';

  beforeEach(() => {
    state = new TodoState();
  });

  describe('loadFromFile', () => {
    it('loads from file and returns true', async () => {
      const fileContent = JSON.stringify({
        version: 1,
        phases: [
          { id: 'phase-1', name: 'Phase 1', tasks: [{ id: 'task-1', content: 'Task', status: 'pending' }] },
        ],
        nextTaskId: 2,
        nextPhaseId: 2,
        updatedAt: new Date().toISOString(),
      });
      fsMap.set('/test/.piclaw/agent/todos.json', fileContent);
      const loaded = await state.loadFromFile(cwd);
      expect(loaded).toBe(true);
      expect(state.phases).toHaveLength(1);
      expect(state.phases[0].name).toBe('Phase 1');
      expect(state.nextTaskId).toBe(2);
      expect(state.nextPhaseId).toBe(2);
      expect(state.storageType).toBe('file');
    });

    it('returns false and keeps defaults if file missing', async () => {
      const loaded = await state.loadFromFile(cwd);
      expect(loaded).toBe(false);
      expect(state.phases).toHaveLength(0);
      expect(state.nextTaskId).toBe(1);
      expect(state.nextPhaseId).toBe(1);
      expect(state.storageType).toBe('file');
    });
  });

  describe('saveToFile', () => {
    it('writes file with proper structure', async () => {
      state.phases = [{ id: 'phase-1', name: 'P1', tasks: [] }];
      state.nextTaskId = 1;
      state.nextPhaseId = 2;
      await state.saveToFile(cwd);
      const path = '/test/.piclaw/agent/todos.json';
      expect(fsMap.has(path)).toBe(true);
      const content = JSON.parse(fsMap.get(path)!);
      expect(content.version).toBe(1);
      expect(content.phases).toHaveLength(1);
      expect(content.phases[0].id).toBe('phase-1');
      expect(content.nextTaskId).toBe(1);
      expect(content.nextPhaseId).toBe(2);
      expect(content.updatedAt).toBeDefined();
    });
  });

  describe('reconstructFromEntries', () => {
    it('recovers state from most recent toolResult', () => {
      const phases: TodoPhase[] = [
        { id: 'phase-1', name: 'P1', tasks: [{ id: 'task-1', content: 'Task1', status: 'pending' }] },
      ];
      const entries = [
        { type: 'message', message: { role: 'user', content: 'hi' } },
        { type: 'message', message: { role: 'toolResult', toolName: 'todos', details: { phases } } },
      ];
      const found = state.reconstructFromEntries(entries);
      expect(found).toBe(true);
      expect(state.phases).toEqual(phases);
    });

    it('returns false if no valid entry', () => {
      const entries = [{ type: 'message', message: { role: 'user' } }];
      expect(state.reconstructFromEntries(entries)).toBe(false);
    });
  });

  describe('addPhase', () => {
    it('adds a new phase with auto IDs', () => {
      const phase = state.addPhase('Phase 1');
      expect(phase.name).toBe('Phase 1');
      expect(phase.id).toMatch(/^phase-\d+$/);
      expect(state.phases).toHaveLength(1);
      expect(state.nextPhaseId).toBeGreaterThanOrEqual(2);
    });

    it('adds initial tasks with auto task IDs and promotes one to in_progress', () => {
      const phase = state.addPhase('P1', [{ content: 'Task A' }, { content: 'Task B' }]);
      expect(phase.tasks).toHaveLength(2);
      expect(phase.tasks[0].id).toMatch(/^task-\d+$/);
      expect(phase.tasks[0].content).toBe('Task A');
      expect(phase.tasks[1].content).toBe('Task B');
      // One task should be in_progress, the other pending
      const statuses = phase.tasks.map(t => t.status).sort();
      expect(statuses).toEqual(['in_progress', 'pending']);
    });
  });

  describe('addTask', () => {
    it('adds task to existing phase by ID and promotes to in_progress if none', () => {
      const phase = state.addPhase('P1'); // empty phase
      const task = state.addTask(phase.id, 'New task');
      expect(task).not.toBeNull();
      expect(task!.content).toBe('New task');
      // Since phase had no tasks, after adding, normalize promotes it to in_progress
      expect(task!.status).toBe('in_progress');
      expect(state.phases.find(p => p.id === phase.id)!.tasks).toHaveLength(1);
    });

    it('returns null if phase not found', () => {
      const task = state.addTask('phase-999', 'Task');
      expect(task).toBeNull();
    });
  });

  describe('updateTask', () => {
    it('updates status, content, notes, details', () => {
      const phase = state.addPhase('P1', [{ content: 'T1' }]);
      const taskId = phase.tasks[0].id;
      const task = state.updateTask(taskId, { status: 'completed', notes: 'note' });
      expect(task).not.toBeNull();
      expect(task!.status).toBe('completed');
      expect(task!.notes).toBe('note');
    });

    it('returns null if task not found', () => {
      const res = state.updateTask('nonexistent', { status: 'completed' });
      expect(res).toBeNull();
    });
  });

  describe('removeTask', () => {
    it('removes task by ID', () => {
      const phase = state.addPhase('P1', [{ content: 'A' }, { content: 'B' }]);
      const taskId = phase.tasks[0].id;
      const removed = state.removeTask(taskId);
      expect(removed).toBe(true);
      expect(state.phases[0].tasks).toHaveLength(1);
      expect(state.phases[0].tasks[0].content).toBe('B');
    });

    it('returns false if task not found', () => {
      const removed = state.removeTask('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('replacePhases', () => {
    it('replaces entire phases array and recalc IDs', () => {
      state.addPhase('P1'); // nextPhaseId becomes 2
      const newPhases: TodoPhase[] = [{ id: 'phase-10', name: 'P10', tasks: [] }];
      state.replacePhases(newPhases);
      expect(state.phases).toHaveLength(1);
      expect(state.phases[0].name).toBe('P10');
      // nextPhaseId should be computed: max(10) + 1 = 11
      expect(state.nextPhaseId).toBe(11);
    });
  });

  describe('getPhases', () => {
    it('returns deep clone', () => {
      state.addPhase('P1', [{ content: 'T1' }]);
      const clone = state.getPhases();
      expect(clone).not.toBe(state.phases);
      expect(clone[0].tasks[0]).not.toBe(state.phases[0].tasks[0]);
      // Mutating clone does not affect state
      clone[0].tasks[0].content = 'Changed';
      expect(state.phases[0].tasks[0].content).toBe('T1');
    });
  });
});

// ================================
// applyOp Tests
// ================================

describe('applyOp', () => {
  it('add_phase: adds new phase', () => {
    let phases: TodoPhase[] = [];
    let nextTid = 1, nextPid = 1;
    const result = applyOp(phases, nextTid, nextPid, { add_phase: { name: 'New Phase' } });
    expect(result.phases).toHaveLength(1);
    expect(result.phases[0].name).toBe('New Phase');
    expect(result.nextPhaseId).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it('add_phase: validates name is string', () => {
    let phases: TodoPhase[] = [];
    let nextTid = 1, nextPid = 1;
    const result = applyOp(phases, nextTid, nextPid, { add_phase: { name: 123 } } as any);
    expect(result.errors).toContain("add_phase.name must be a string (not an object or array)");
    expect(result.phases).toHaveLength(0);
  });

  it('add_task: adds task to phase by id or name', () => {
    let phases: TodoPhase[] = [{ id: 'phase-1', name: 'P1', tasks: [] }];
    let nextTid = 1, nextPid = 2;
    let result = applyOp(phases, nextTid, nextPid, { add_task: { phase: 'phase-1', content: 'Do stuff' } });
    expect(result.phases[0].tasks).toHaveLength(1);
    expect(result.phases[0].tasks[0].content).toBe('Do stuff');
    // After adding, task promoted to in_progress
    expect(result.phases[0].tasks[0].status).toBe('in_progress');
    expect(result.nextTaskId).toBe(2);
    expect(result.errors).toHaveLength(0);

    // also by phase name
    result = applyOp(result.phases, result.nextTaskId, result.nextPhaseId, { add_task: { phase: 'P1', content: 'Another' } });
    expect(result.phases[0].tasks).toHaveLength(2);
    // The first task remains in_progress, the new task should be pending because there's already an in_progress
    const statuses = result.phases[0].tasks.map(t => t.status);
    expect(statuses).toContain('in_progress');
    expect(statuses).toContain('pending');
  });

  it('add_task: error when phase not found', () => {
    let phases: TodoPhase[] = [];
    let nextTid = 1, nextPid = 1;
    const result = applyOp(phases, nextTid, nextPid, { add_task: { phase: 'missing', content: 'X' } });
    expect(result.errors).toContain('Phase "missing" not found');
  });

  it('update: single id', () => {
    let phases: TodoPhase[] = [
      { id: 'phase-1', name: 'P1', tasks: [{ id: 'task-1', content: 'A', status: 'pending' }] },
    ];
    let nextTid = 2, nextPid = 2;
    const result = applyOp(phases, nextTid, nextPid, { update: { id: 'task-1', status: 'completed' } });
    expect(result.phases[0].tasks[0].status).toBe('completed');
    expect(result.errors).toHaveLength(0);
  });

  it('update: batch ids', () => {
    let phases: TodoPhase[] = [
      { id: 'phase-1', name: 'P1', tasks: [
        { id: 'task-1', content: 'A', status: 'pending' },
        { id: 'task-2', content: 'B', status: 'pending' },
      ]},
    ];
    let nextTid = 3, nextPid = 2;
    const result = applyOp(phases, nextTid, nextPid, { update: { ids: ['task-1', 'task-2'], status: 'in_progress' } });
    const statuses = result.phases[0].tasks.map(t => t.status).sort();
    // After batch update, both set to in_progress, then normalize reduces to exactly one in_progress and one pending
    expect(statuses).toContain('in_progress');
    expect(statuses).toContain('pending');
    expect(result.errors).toHaveLength(0);
  });

  it('update: error if neither id nor ids provided', () => {
    let phases: TodoPhase[] = [];
    let result = applyOp(phases, 1, 1, { update: { status: 'completed' } });
    expect(result.errors.some(e => e.includes("'id' (string) or 'ids' (array of strings)"))).toBe(true);
  });

  it('update: invalid status error does not change other task', () => {
    // Setup: phase with two tasks: one in_progress, one pending
    let phases: TodoPhase[] = [
      { id: 'phase-1', name: 'P1', tasks: [
        { id: 'task-1', content: 'A', status: 'in_progress' },
        { id: 'task-2', content: 'B', status: 'pending' },
      ]},
    ];
    let nextTid = 3, nextPid = 2;
    const result = applyOp(phases, nextTid, nextPid, { update: { id: 'task-2', status: 'invalid' as any } });
    expect(result.errors.some(e => e.includes('Invalid status'))).toBe(true);
    // Pending task should remain pending because it wasn't updated
    const task2 = result.phases[0].tasks.find(t => t.id === 'task-2')!;
    expect(task2.status).toBe('pending');
    // in_progress remains
    const task1 = result.phases[0].tasks.find(t => t.id === 'task-1')!;
    expect(task1.status).toBe('in_progress');
  });

  it('remove_task: removes existing task', () => {
    let phases: TodoPhase[] = [
      { id: 'phase-1', name: 'P1', tasks: [
        { id: 'task-1', content: 'A', status: 'pending' },
        { id: 'task-2', content: 'B', status: 'pending' },
      ]},
    ];
    let nextTid = 3, nextPid = 2;
    const result = applyOp(phases, nextTid, nextPid, { remove_task: { id: 'task-1' } });
    expect(result.phases[0].tasks).toHaveLength(1);
    expect(result.phases[0].tasks[0].id).toBe('task-2');
    expect(result.errors).toHaveLength(0);
  });

  it('remove_task: error when id missing or not found', () => {
    let phases: TodoPhase[] = [{ id: 'phase-1', name: 'P1', tasks: [] }];
    let result = applyOp(phases, 1, 1, { remove_task: {} } as any);
    expect(result.errors).toContain('remove_task.id must be a string (e.g., \'task-1\')');
    result = applyOp(phases, 1, 1, { remove_task: { id: 'missing' } });
    expect(result.errors).toContain('Task "missing" not found');
  });

  it('delete: clears all', () => {
    let phases: TodoPhase[] = [
      { id: 'phase-1', name: 'P1', tasks: [{ id: 'task-1', content: 'A', status: 'pending' }] },
    ];
    let nextTid = 2, nextPid = 2;
    const result = applyOp(phases, nextTid, nextPid, { delete: {} });
    expect(result.phases).toHaveLength(0);
    expect(result.nextTaskId).toBe(1);
    expect(result.nextPhaseId).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('list: no change', () => {
    let phases: TodoPhase[] = [
      { id: 'phase-1', name: 'P1', tasks: [{ id: 'task-1', content: 'A', status: 'pending' }] },
    ];
    let nextTid = 2, nextPid = 2;
    const result = applyOp(phases, nextTid, nextPid, { list: {} });
    expect(result.phases).toEqual(phases);
    expect(result.errors).toHaveLength(0);
  });
});

// ================================
// formatSummary Tests
// ================================

describe('formatSummary', () => {
  it('shows errors when provided (empty tasks)', () => {
    const text = formatSummary([], ['Something wrong']);
    expect(text).toBe('Errors: Something wrong');
  });

  it('shows cleared message when empty no errors', () => {
    const text = formatSummary([], []);
    expect(text).toBe('Todo list cleared.');
  });

  it('formats tasks with statuses correctly', () => {
    const phases: TodoPhase[] = [
      {
        id: 'phase-1',
        name: 'Phase 1',
        tasks: [
          { id: 'task-1', content: 'Pending task', status: 'pending' },
          { id: 'task-2', content: 'In progress task', status: 'in_progress', details: 'Details line1\nDetails line2' },
          { id: 'task-3', content: 'Completed task', status: 'completed' },
          { id: 'task-4', content: 'Abandoned', status: 'abandoned' },
        ],
      },
    ];
    const text = formatSummary(phases, []);
    expect(text).toContain('✅ Todo updated: 2 remaining, 1 completed.');
    expect(text).toContain('Remaining items (2):');
    // Only pending/in_progress tasks are listed in remaining items
    expect(text).toContain('  - task-1 Pending task [pending] (Phase 1)');
    expect(text).toContain('  - task-2 In progress task [in_progress] (Phase 1)');
    // Details lines are indented with 6 spaces
    expect(text).toContain('      Details line1');
    expect(text).toContain('      Details line2');
    // Summary phase line
    expect(text).toContain('Phase 1/1 "Phase 1" — 2/4 tasks complete');
  });
});

// ================================
// getLatestTodoPhasesFromEntries Tests
// ================================

describe('getLatestTodoPhasesFromEntries', () => {
  it('extracts phases from latest valid toolResult', () => {
    const phases: TodoPhase[] = [{ id: 'p1', name: 'P1', tasks: [] }];
    const entries = [
      { type: 'message', message: { role: 'user' } },
      { type: 'message', message: { role: 'toolResult', toolName: 'todos', details: { phases } } },
    ];
    const result = getLatestTodoPhasesFromEntries(entries);
    expect(result).toEqual(phases);
  });

  it('ignores error entries', () => {
    const phases: TodoPhase[] = [{ id: 'p1', name: 'P1', tasks: [] }];
    const entries = [
      { type: 'message', message: { role: 'toolResult', toolName: 'todos', isError: true, details: { phases: [] } } },
      { type: 'message', message: { role: 'toolResult', toolName: 'todos', details: { phases } } },
    ];
    const result = getLatestTodoPhasesFromEntries(entries);
    expect(result).toEqual(phases);
  });

  it('returns empty if none found', () => {
    const entries = [{ type: 'message', message: { role: 'user' } }];
    expect(getLatestTodoPhasesFromEntries(entries)).toEqual([]);
  });
});

// ================================
// renderTodosCall Tests
// ================================

describe('renderTodosCall', () => {
  const mockTheme = {
    fg: (c: string, v: string) => v,
    bold: (v: string) => v,
  };

  it('shows operation name for add_phase', () => {
    const comp = renderTodosCall({ add_phase: { name: 'P' } }, mockTheme);
    expect(comp.text).toContain('todos add_phase');
  });

  it('shows delete operation', () => {
    const comp = renderTodosCall({ delete: {} }, mockTheme);
    expect(comp.text).toContain('todos delete');
  });

  it('shows list operation', () => {
    const comp = renderTodosCall({ list: {} }, mockTheme);
    expect(comp.text).toContain('todos list');
  });

  it('shows add_task operation', () => {
    const comp = renderTodosCall({ add_task: { phase: 'p1', content: 'T' } }, mockTheme);
    expect(comp.text).toContain('todos add_task');
  });
});

// ================================
// renderTodosResult Tests
// ================================

describe('renderTodosResult', () => {
  const mockTheme = {
    fg: (c: string, v: string) => v,
    bold: (v: string) => v,
  };

  it('returns empty Text if no details', () => {
    const comp = renderTodosResult({} as any, { expanded: false, isPartial: false }, mockTheme);
    expect(comp.text).toBe('');
  });

  it('shows error in details', () => {
    const comp = renderTodosResult({ details: { error: 'Fail' } } as any, { expanded: false, isPartial: false }, mockTheme);
    expect(comp.text).toContain('Error: Fail');
  });

  it('shows processing when partial', () => {
    // Provide a details object to avoid early empty return
    const comp = renderTodosResult({ details: {} } as any, { expanded: false, isPartial: true }, mockTheme);
    expect(comp.text).toContain('Processing...');
  });

  it('renders list of tasks correctly (expanded)', () => {
    const phase: TodoPhase = {
      id: 'phase-1',
      name: 'P1',
      tasks: [
        { id: 'task-1', content: 'Do A', status: 'pending' },
        { id: 'task-2', content: 'Do B', status: 'in_progress' },
        { id: 'task-3', content: 'Do C', status: 'completed' },
        { id: 'task-4', content: 'Do D', status: 'abandoned' },
      ],
    };
    const comp = renderTodosResult({ details: { phases: [phase], storage: 'file' } } as any, { expanded: true, isPartial: false }, mockTheme);
    const text = comp.text;
    expect(text).toContain('Todos: 4 tasks');
    expect(text).toContain('task-1 Do A');
    expect(text).toContain('→ task-2 Do B');
    expect(text).toContain('✓ task-3 Do C');
    expect(text).toContain('✗ task-4 Do D');
  });

  it('truncates tasks when not expanded', () => {
    const tasks = Array.from({ length: 10 }, (_, i) => ({
      id: `task-${i+1}`,
      content: `Task ${i+1}`,
      status: 'pending' as const,
    }));
    const phase: TodoPhase = { id: 'phase-1', name: 'P1', tasks };
    const comp = renderTodosResult({ details: { phases: [phase], storage: 'file' } } as any, { expanded: false, isPartial: false }, mockTheme);
    const text = comp.text;
    expect(text).toContain('... 5 more');
  });

  it('shows no tasks as dim', () => {
    const phase: TodoPhase = { id: 'phase-1', name: 'P1', tasks: [] };
    const comp = renderTodosResult({ details: { phases: [phase] } } as any, { expanded: false, isPartial: false }, mockTheme);
    expect(comp.text).toBe('No todos');
  });
});

// ================================
// TodoTool execute Tests (unit)
// ================================

describe('TodoTool execute', () => {
  const cwd = '/test';
  let api: any;
  let tool: any;

  beforeEach(() => {
    api = {
      on: vi.fn(),
      exec: vi.fn(),
      sendMessage: vi.fn(),
    };
    tool = createTodoTool(api);
  });

  it('returns error for invalid JSON string', async () => {
    const result = await tool.execute('call1', '{ invalid json }', undefined, undefined, { cwd });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('JSON');
  });

  it('handles file save failure gracefully', async () => {
    // Mock withFileMutationQueue to throw
    const { withFileMutationQueue } = await import('@earendil-works/pi-coding-agent');
    (withFileMutationQueue as any).mockImplementationOnce(async () => {
      throw new Error('disk full');
    });

    const result = await tool.execute('call2', { add_phase: { name: 'P1' } }, undefined, undefined, { cwd });
    expect(result.isError).toBe(true);
    expect(result.details.storage).toBe('memory');
    expect(result.content[0].text).toContain('Save failed');
  });

  it('successful add_phase with tasks', async () => {
    const result = await tool.execute('call3', { add_phase: { name: 'P1', tasks: [{ content: 'Task1' }] } }, undefined, undefined, { cwd });
    expect(result.isError).toBe(false);
    expect(result.details.phases).toHaveLength(1);
    expect(result.details.phases[0].tasks).toHaveLength(1);
    expect(result.details.storage).toBe('file');
    expect(result.content[0].text).toContain('✅ Todo updated');
  });
});

// ================================
// TodoTool Session Lifecycle Tests
// ================================

describe('TodoTool session lifecycle', () => {
  const cwd = '/test';
  let api: any;
  let tool: any;

  beforeEach(() => {
    api = {
      on: vi.fn(),
      exec: vi.fn(),
      sendMessage: vi.fn(),
    };
    tool = createTodoTool(api);
  });

  it('session_start loads from file when no session entries', async () => {
    // Prepare a todo file
    const fileContent = JSON.stringify({
      version: 1,
      phases: [{ id: 'phase-1', name: 'P1', tasks: [] }],
      nextTaskId: 1,
      nextPhaseId: 2,
      updatedAt: new Date().toISOString(),
    });
    fsMap.set('/test/.piclaw/agent/todos.json', fileContent);

    // Find the session_start handler that was registered
    const sessionStartCall = api.on.mock.calls.find((c: any) => c[0] === 'session_start');
    expect(sessionStartCall).toBeDefined();
    const handler = sessionStartCall[1];

    const mockCtx = {
      cwd,
      sessionManager: {
        getBranch: () => [], // no session entries
      },
    } as any;

    await handler(null as any, mockCtx);

    // After handler, state should be loaded from file; execute list should return the phase
    const result = await tool.execute('tid', { list: {} }, undefined, undefined, mockCtx);
    expect(result.isError).toBe(false);
    expect(result.details.phases).toHaveLength(1);
    expect(result.details.phases[0].name).toBe('P1');
    expect(result.details.storage).toBe('file');
  });

  it('session_start uses session branch if available', async () => {
    const phases: TodoPhase[] = [{ id: 'phase-x', name: 'PX', tasks: [] }];
    const mockCtx = {
      cwd,
      sessionManager: {
        getBranch: () => [
          { type: 'message', message: { role: 'toolResult', toolName: 'todos', details: { phases } } },
        ],
      },
    } as any;

    const sessionStartCall = api.on.mock.calls.find((c: any) => c[0] === 'session_start');
    const handler = sessionStartCall[1];
    await handler(null as any, mockCtx);

    // Execute list should return the session-recovered phases
    const result = await tool.execute('tid', { list: {} }, undefined, undefined, mockCtx);
    expect(result.details.phases).toEqual(phases);
    expect(result.details.storage).toBe('session');
  });

  it('session_tree behaves like session_start', async () => {
    // Similar to session_start but triggered on session_tree event
    const fileContent = JSON.stringify({
      version: 1,
      phases: [{ id: 'phase-2', name: 'P2', tasks: [] }],
      nextTaskId: 1,
      nextPhaseId: 3,
      updatedAt: new Date().toISOString(),
    });
    fsMap.set('/test/.piclaw/agent/todos.json', fileContent);

    const sessionTreeCall = api.on.mock.calls.find((c: any) => c[0] === 'session_tree');
    expect(sessionTreeCall).toBeDefined();
    const handler = sessionTreeCall[1];

    const mockCtx = {
      cwd,
      sessionManager: {
        getBranch: () => [],
      },
    } as any;

    await handler(null as any, mockCtx);

    const result = await tool.execute('tid2', { list: {} }, undefined, undefined, mockCtx);
    expect(result.details.phases).toHaveLength(1);
    expect(result.details.phases[0].name).toBe('P2');
  });
});
