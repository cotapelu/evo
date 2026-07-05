import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTodosRenderer } from '../../../extensions/renderers/todos-renderer.ts';

// Mock @earendil-works/pi-tui Text
vi.mock('@earendil-works/pi-tui', () => ({
  Text: class Text {
    text: string;
    constructor(text: string, _x: number, _y: number) {
      this.text = text;
    }
  },
}));

describe('Todos Renderer', () => {
  let mockApi: any;
  let capturedRenderer: any;

  beforeEach(() => {
    mockApi = { registerMessageRenderer: vi.fn() };
    capturedRenderer = null;
    (mockApi.registerMessageRenderer as any).mockImplementation((type: string, fn: any) => {
      if (type === 'todos_result') capturedRenderer = fn;
    });
    registerTodosRenderer(mockApi);
  });

  function mockTheme() {
    return {
      fg: (c: string, v: string) => v,
      bold: (v: string) => v,
    };
  }

  it('renders fallback when no details', () => {
    const msg = { details: undefined, content: [] };
    const result = capturedRenderer(msg, {}, mockTheme());
    expect(result.text).toBe('📋 Todo operation completed');
  });

  it('renders progress bar and percentage', () => {
    const msg = {
      details: {
        action: 'list',
        totalTasks: 10,
        completedTasks: 5
      },
      content: []
    };
    const result = capturedRenderer(msg, {}, mockTheme());
    const text = result.text;
    expect(text).toContain('Progress: 5/10 (50%)');
    // bar: 10 filled of 20 -> 50%
    expect(text).toContain('█'.repeat(10) + '░'.repeat(10));
  });

  it('renders progress bar with success color when 100%', () => {
    const msg = {
      details: {
        action: 'list',
        totalTasks: 5,
        completedTasks: 5
      },
      content: []
    };
    const result = capturedRenderer(msg, {}, mockTheme());
    // Since our mock theme.fg returns the string itself, we can't check color but we can check the bar exists
    expect(result.text).toContain('Progress: 5/5 (100%)');
  });

  it('renders message from details', () => {
    const msg = {
      details: {
        action: 'list',
        totalTasks: 0,
        completedTasks: 0,
        message: 'Todo list cleared.'
      },
      content: []
    };
    const result = capturedRenderer(msg, {}, mockTheme());
    expect(result.text).toContain('Todo list cleared.');
  });

  it('renders phases with tasks and status icons', () => {
    const msg = {
      details: {
        action: 'list',
        phases: [
          {
            name: 'Phase A',
            tasks: [
              { id: 'task-1', content: 'First task', status: 'pending' },
              { id: 'task-2', content: 'Ongoing', status: 'in_progress' },
              { id: 'task-3', content: 'Done', status: 'completed' }
            ]
          }
        ]
      },
      content: []
    };
    const result = capturedRenderer(msg, {}, mockTheme());
    const text = result.text;
    expect(text).toContain('Phase A');
    expect(text).toContain('First task');
    expect(text).toContain('Ongoing');
    expect(text).toContain('Done');
    // Check icons present
    expect(text).toContain('⏳'); // pending
    expect(text).toContain('🔄'); // in_progress
    expect(text).toContain('✅'); // completed
    // Check ID line
    expect(text).toContain('ID: task-1');
  });

  it('handles empty phases array', () => {
    const msg = {
      details: { action: 'list', phases: [] },
      content: []
    };
    const result = capturedRenderer(msg, {}, mockTheme());
    expect(result.text).toContain('📋 TODO List');
    // No tasks shown
    expect(result.text).not.toContain('⏳');
  });
});
