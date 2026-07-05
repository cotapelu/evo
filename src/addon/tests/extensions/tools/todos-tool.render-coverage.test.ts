import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTodoTool } from '../../../extensions/tools/todos-tool.ts';

// Minimal mock theme that returns raw text
const mockTheme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

describe('todos-tool render branch coverage', () => {
  let mockApi: any;
  let tool: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = { on: vi.fn(), registerTool: vi.fn() };
    tool = createTodoTool(mockApi);
  });

  describe('renderCall', () => {
    it('renders delete operation', () => {
      const comp = tool.renderCall({ delete: {} }, mockTheme);
      expect(comp.text).toContain('delete');
    });

    it('renders add_phase operation', () => {
      const comp = tool.renderCall({ add_phase: { name: 'P1', tasks: [] } }, mockTheme);
      expect(comp.text).toContain('add_phase');
    });

    it('renders add_task operation', () => {
      const comp = tool.renderCall({ add_task: { phase: 'p1', content: 'Task A' } }, mockTheme);
      expect(comp.text).toContain('add_task');
    });

    it('renders update operation with id', () => {
      const comp = tool.renderCall({ update: { id: 't1', status: 'completed' } }, mockTheme);
      expect(comp.text).toContain('update');
    });

    it('renders update operation with ids array', () => {
      const comp = tool.renderCall({ update: { ids: ['t1', 't2'], status: 'pending' } }, mockTheme);
      expect(comp.text).toContain('update');
    });

    it('renders remove_task operation', () => {
      const comp = tool.renderCall({ remove_task: { id: 't42' } }, mockTheme);
      expect(comp.text).toContain('remove_task');
    });

    it('renders list operation', () => {
      const comp = tool.renderCall({ list: {} }, mockTheme);
      expect(comp.text).toContain('list');
    });

    it('renders unknown operation as todo', () => {
      const comp = tool.renderCall({ unknown: true }, mockTheme);
      expect(comp.text).toContain('todo');
    });
  });

  describe('renderResult', () => {
    it('returns empty when details missing', () => {
      const result = { isError: false, content: [] };
      const comp = tool.renderResult(result, { expanded: false, isPartial: false }, mockTheme);
      expect(comp.text).toBe('');
    });

    it('shows error message when details.error present', () => {
      const result = { isError: true, content: [], details: { error: 'Validation failed' } };
      const comp = tool.renderResult(result, { expanded: false, isPartial: false }, mockTheme);
      expect(comp.text).toContain('Error');
      expect(comp.text).toContain('Validation failed');
    });

    it('shows Processing... when isPartial true', () => {
      const result = { isError: false, content: [], details: {} };
      const comp = tool.renderResult(result, { expanded: false, isPartial: true }, mockTheme);
      expect(comp.text).toBe('Processing...');
    });

    it('shows No todos when phases contain no tasks', () => {
      const result = { isError: false, content: [], details: { phases: [{ id: 'p1', name: 'Empty', tasks: [] }] } };
      const comp = tool.renderResult(result, { expanded: false, isPartial: false }, mockTheme);
      expect(comp.text).toContain('No todos');
    });

    it('shows task list when expanded and tasks present', () => {
      const result = {
        isError: false,
        content: [],
        details: {
          phases: [
            {
              id: 'p1',
              name: 'Phase 1',
              tasks: [
                { id: 't1', content: 'Task 1', status: 'pending' },
                { id: 't2', content: 'Task 2', status: 'in_progress', details: 'Extra' }
              ]
            }
          ]
        }
      };
      const comp = tool.renderResult(result, { expanded: true, isPartial: false }, mockTheme);
      expect(comp.text).toContain('Todos:');
      expect(comp.text).toContain('Task 1');
      expect(comp.text).toContain('Task 2');
    });

    it('truncates list when not expanded and many tasks', () => {
      const tasks = Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, content: `Task ${i}`, status: 'pending' }));
      const result = { isError: false, content: [], details: { phases: [{ id: 'p1', name: 'P1', tasks }] } };
      const comp = tool.renderResult(result, { expanded: false, isPartial: false }, mockTheme);
      expect(comp.text).toContain('...');
      expect(comp.text).toContain('more');
    });

    it('includes status symbols for in_progress, completed, abandoned', () => {
      const result = {
        isError: false,
        content: [],
        details: {
          phases: [
            {
              id: 'p1',
              name: 'All',
              tasks: [
                { id: 't1', content: 'In-prog', status: 'in_progress', details: 'Details' },
                { id: 't2', content: 'Done', status: 'completed' },
                { id: 't3', content: 'Abandoned', status: 'abandoned' }
              ]
            }
          ]
        }
      };
      const comp = tool.renderResult(result, { expanded: true, isPartial: false }, mockTheme);
      const t = comp.text;
      expect(t).toContain('→');
      expect(t).toContain('✓');
      expect(t).toContain('✗');
    });

    it('shows phase separator when multiple phases', () => {
      const result = {
        isError: false,
        content: [],
        details: {
          phases: [
            { id: 'p1', name: 'First', tasks: [{ id: 't1', content: 'A', status: 'pending' }] },
            { id: 'p2', name: 'Second', tasks: [{ id: 't2', content: 'B', status: 'pending' }] }
          ]
        }
      };
      const comp = tool.renderResult(result, { expanded: false, isPartial: false }, mockTheme);
      expect(comp.text).toContain('▼ First');
      expect(comp.text).toContain('▼ Second');
    });
  });
});
