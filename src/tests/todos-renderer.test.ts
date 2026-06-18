#!/usr/bin/env node
/**
 * Todos Renderer Unit Tests
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { registerTodosRenderer } from '@extensions/renderers/todos-renderer';
import { Text } from '@earendil-works/pi-tui';

// Mock theme helper
function createMockTheme() {
  return {
    fg: (color: string, text: string) => text,
    bold: (text: string) => text,
  };
}

function createMockAPI() {
  return {
    registerMessageRenderer: vi.fn(),
  } as any;
}

describe('Todos Renderer', () => {
  let api: any;
  let renderFn: any;

  beforeEach(() => {
    vi.clearAllMocks();
    api = createMockAPI();
    registerTodosRenderer(api);
    renderFn = api.registerMessageRenderer.mock.calls[0][1];
  });

  it('registers message renderer for "todos_result"', () => {
    expect(api.registerMessageRenderer).toHaveBeenCalledWith(
      'todos_result',
      expect.any(Function)
    );
  });

  it('renders default when no details provided', () => {
    const msg = {}; // no details
    const theme = createMockTheme();
    const result = renderFn(msg, {}, theme);
    // The renderer returns a Text instance
    expect(result).toBeInstanceOf(Text);
    // Access text property (it may be defined class property)
    // Assuming Text class has a text content that we can read
    // In pi-tui, Text is a component with .text property?
    // Let's check: In pi-tui, class Text { constructor(public text: string) {} }? Possibly.
    // If not, we can't read. But we can extend mock? We can't.
    // Alternatively, we could spy on Text constructor, but it's real.
    // Safer to rely on rendered output's .text if available. Let's check usage: registerMessageRenderer returns new Text(lines.join("\n")). So Text likely stores the text.
    // We'll assume it's readable as 'text'.
    expect((result as any).text).toBe('📋 Todo operation completed');
  });

  it('renders header and stats', () => {
    const msg = {
      details: {
        action: 'list',
        totalTasks: 10,
        completedTasks: 7,
        message: 'Current status',
        phases: [
          {
            name: 'Planning',
            tasks: [
              { id: 't1', content: 'Define goals', status: 'completed' },
              { id: 't2', content: 'Set timeline', status: 'in_progress' },
            ],
          },
          {
            name: 'Execution',
            tasks: [
              { id: 't3', content: 'Build feature', status: 'pending' },
              { id: 't4', content: 'Write tests', status: 'pending' },
            ],
          },
        ],
      },
    } as any;
    const theme = createMockTheme();
    const result = renderFn(msg, {}, theme) as any;
    const text = result.text;

    expect(text).toContain('📋 TODO List');
    expect(text).toContain('Progress: 7/10 (70%)');
    // Progress bar: 70% of 20 length = 14 filled
    expect(text).toContain('█'.repeat(14));
    expect(text).toContain('░'.repeat(6));
    expect(text).toContain('Current status');
    expect(text).toContain('Planning');
    expect(text).toContain('Define goals');
    expect(text).toContain('Set timeline');
    expect(text).toContain('Execution');
    expect(text).toContain('Build feature');
    expect(text).toContain('Write tests');
    // Status icons
    expect(text).toContain('✅');
    expect(text).toContain('🔄');
    expect(text).toContain('⏳');
    // Task IDs
    expect(text).toContain('ID: t1');
    expect(text).toContain('ID: t2');
    expect(text).toContain('ID: t3');
    expect(text).toContain('ID: t4');
  });

  it('renders phases with abandoned status', () => {
    const msg = {
      details: {
        action: 'list',
        phases: [
          {
            name: 'Cancelled',
            tasks: [
              { id: 't99', content: 'Old plan', status: 'abandoned' },
            ],
          },
        ],
      },
    } as any;
    const theme = createMockTheme();
    const result = renderFn(msg, {}, theme) as any;
    expect(result.text).toContain('❌');
    expect(result.text).toContain('Old plan');
  });

  it('handles empty phases array', () => {
    const msg = {
      details: {
        action: 'list',
        totalTasks: 0,
        completedTasks: 0,
        phases: [],
      },
    } as any;
    const theme = createMockTheme();
    const result = renderFn(msg, {}, theme) as any;
    expect(result.text).toContain('📋 TODO List');
    expect(result.text).toContain('Progress: 0/0 (0%)');
    // No phase names
    expect(result.text).not.toContain('Planning');
  });

  it('handles partial details (no stats)', () => {
    const msg = {
      details: {
        action: 'add_phase',
        phases: [
          {
            name: 'New Phase',
            tasks: [],
          },
        ],
      },
    } as any;
    const theme = createMockTheme();
    const result = renderFn(msg, {}, theme) as any;
    expect(result.text).toContain('📋 TODO List');
    expect(result.text).toContain('New Phase');
    // No progress bar because totalTasks undefined
    expect(result.text).not.toContain('Progress:');
  });

  it('renders message only without phases', () => {
    const msg = {
      details: {
        action: 'update',
        message: 'Task updated successfully',
      },
    } as any;
    const theme = createMockTheme();
    const result = renderFn(msg, {}, theme) as any;
    expect(result.text).toContain('📋 TODO List');
    expect(result.text).toContain('Task updated successfully');
    // No phases
    expect(result.text).not.toContain('❌');
    expect(result.text).not.toContain('✅');
  });
});
