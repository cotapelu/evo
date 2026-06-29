#!/usr/bin/env node
/**
 * Memory Renderer Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Text } from '@earendil-works/pi-tui';
import { registerMemoryRenderer } from '@extensions/renderers/memory-renderer';

// Mock pi-tui's Text class to capture the rendered text
vi.mock('@earendil-works/pi-tui', () => ({
  Text: class {
    text: string;
    constructor(text: string) {
      this.text = text;
    }
  },
}));

// Mock render-utils styleError to just return the text (so we can test error messages)
vi.mock('../utils/render-utils.js', () => ({
  styleError: (theme: any, text: string) => text,
}));

function createMockAPI() {
  return { registerMessageRenderer: vi.fn() } as any;
}

function createMockTheme() {
  return {
    fg: (color: string, text: string) => text,
    bold: (text: string) => text,
  };
}

describe('Memory Renderer', () => {
  let api: any;
  let renderFn: any;

  beforeEach(() => {
    vi.clearAllMocks();
    api = createMockAPI();
    registerMemoryRenderer(api);
    renderFn = api.registerMessageRenderer.mock.calls[0][1];
  });

  it('registers message renderer for "memory_result"', () => {
    expect(api.registerMessageRenderer).toHaveBeenCalledWith(
      'memory_result',
      expect.any(Function)
    );
  });

  it('renders default when no details', () => {
    const msg = {};
    const theme = createMockTheme();
    const result = renderFn(msg, {}, theme);
    expect(result).toBeInstanceOf(Text);
    expect(result.text).toBe('🧠 Memory operation');
  });

  it('renders header, action, and total count', () => {
    const msg = {
      details: {
        action: 'list',
        memories: [
          { id: 1, text: 'First', tags: ['a'] },
          { id: 2, text: 'Second', tags: [] },
        ],
        nextId: 3,
      },
    } as any;
    const theme = createMockTheme();
    const result = renderFn(msg, {}, theme);
    expect(result.text).toContain('🧠 Memory');
    expect(result.text).toContain('Action: list');
    expect(result.text).toContain('Total: 2 memories');
  });

  it('includes content text unless it contains error', () => {
    const msg = {
      content: [{ type: 'text', text: 'Stored memory #1' }],
      details: {
        action: 'add',
        memories: [],
        nextId: 2,
      },
    } as any;
    const theme = createMockTheme();
    const result = renderFn(msg, {}, theme);
    expect(result.text).toContain('Stored memory #1');
  });

  it('does not include content if it contains error', () => {
    const msg = {
      content: [{ type: 'text', text: 'Error: something went wrong' }],
      details: {
        action: 'delete',
        memories: [],
        nextId: 1,
        error: 'something went wrong',
      },
    } as any;
    const theme = createMockTheme();
    const result = renderFn(msg, {}, theme);
    // Should show the error via styleError instead of raw content
    expect(result.text).not.toContain('Error: something went wrong');
    expect(result.text).toContain('❌ something went wrong');
  });

  it('renders search results with tag icon for matching tags', () => {
    const msg = {
      details: {
        action: 'search',
        query: 'tag1',
        memories: [
          { id: 1, text: 'Memory with tag1', tags: ['tag1', 'other'] },
          { id: 2, text: 'Memory without matching tag', tags: ['other'] },
        ],
        resultCount: 2,
        nextId: 3,
      },
    } as any;
    const theme = createMockTheme();
    const result = renderFn(msg, {}, theme);
    expect(result.text).toContain('Matches:');
    // First memory has matching tag => tag icon
    expect(result.text).toContain('🏷️ #1 Memory with tag1');
    // Second memory => document icon
    expect(result.text).toContain('📝 #2 Memory without matching tag');
  });

  it('limits search results to 15 and shows more count', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      text: `Mem ${i + 1}`,
      tags: [],
    }));
    const msg = {
      details: {
        action: 'search',
        query: '',
        memories: many,
        resultCount: 20,
        nextId: 21,
      },
    } as any;
    const theme = createMockTheme();
    const result = renderFn(msg, {}, theme);
    // Should contain first 15 and then "...and 5 more."
    expect(result.text).toContain('Mem 15');
    expect(result.text).not.toContain('Mem 16');
    expect(result.text).toContain('...and 5 more.');
  });

  it('renders get action with target memory details including date', () => {
    const now = Date.now();
    const msg = {
      details: {
        action: 'get',
        target: {
          id: 42,
          text: 'Important fact',
          tags: ['decision', 'meeting'],
          created: now,
        },
        memories: [],
        nextId: 43,
      },
    } as any;
    const theme = createMockTheme();
    const result = renderFn(msg, {}, theme);
    expect(result.text).toContain('Memory #42');
    expect(result.text).toContain('Important fact');
    expect(result.text).toContain('Tags: decision, meeting');
    expect(result.text).toContain('Created:');
  });

  it('handles missing target for get gracefully', () => {
    const msg = {
      details: {
        action: 'get',
        target: undefined,
        memories: [],
        nextId: 1,
      },
    } as any;
    const theme = createMockTheme();
    const result = renderFn(msg, {}, theme);
    // Should not crash and return something with header but no details
    expect(result.text).toContain('🧠 Memory');
    expect(result.text).not.toContain('Memory #');
  });

  it('handles delete action with no special output', () => {
    const msg = {
      details: {
        action: 'delete',
        deletedId: 5,
        memories: [],
        nextId: 6,
      },
    } as any;
    const theme = createMockTheme();
    const result = renderFn(msg, {}, theme);
    // Should just show header, action, total count (0)
    expect(result.text).toContain('Action: delete');
    expect(result.text).toContain('Total: 0 memories');
  });

  it('handles clear action with clearedCount', () => {
    const msg = {
      details: {
        action: 'clear',
        clearedCount: 10,
        memories: [],
        nextId: 1,
      },
    } as any;
    const theme = createMockTheme();
    const result = renderFn(msg, {}, theme);
    expect(result.text).toContain('Action: clear');
    expect(result.text).toContain('Total: 0 memories');
  });

  it('renders multiple actions sequentially', () => {
    const msgs = [
      { details: { action: 'add', memories: [], nextId: 1 } },
      { details: { action: 'list', memories: [], nextId: 1 } },
      { details: { action: 'search', query: 'test', memories: [], resultCount: 0, nextId: 1 } },
    ];
    const theme = createMockTheme();
    for (const msg of msgs) {
      const res = renderFn(msg, {}, theme);
      expect(res).toBeInstanceOf(Text);
    }
  });
});
