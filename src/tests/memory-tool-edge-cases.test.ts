#!/usr/bin/env node
/**
 * Memory Tool Edge Cases and Uncovered Branches
 *
 * Tests for Mutex, MemoryListComponent, error handling, search, clear, etc.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerMemoryTool, MemoryListComponent } from '@extensions/tools/memory-tool';
import { createMockExtensionAPI } from './utils/mock-factory.js';

// Helper to create mock context
function createMockCtx() {
  return {
    cwd: '/test',
    sessionManager: { getBranch: vi.fn() },
    exec: vi.fn(),
    ui: { notify: vi.fn() },
  } as any;
}

describe('Memory Tool Edge Cases', () => {
  let api: any;
  let tool: any;

  beforeEach(() => {
    api = createMockExtensionAPI({ appendEntry: vi.fn() });
    registerMemoryTool(api);
    tool = api.registerTool.mock.calls[0][0];
    vi.clearAllMocks();
  });

  describe('Mutex Basic', () => {
    it('should allow concurrent sequential executions without deadlock', async () => {
      const ctx = createMockCtx();
      (ctx.sessionManager.getBranch as any).mockReturnValue([]);

      const results = await Promise.all([
        tool.execute('1', { action: 'add', text: 'A' }, undefined, undefined, ctx),
        tool.execute('2', { action: 'add', text: 'B' }, undefined, undefined, ctx),
        tool.execute('3', { action: 'add', text: 'C' }, undefined, undefined, ctx),
      ]);

      expect(results.every(r => !r.isError)).toBe(true);
      expect(api.appendEntry).toHaveBeenCalledTimes(3);
    });
  });

  describe('MemoryListComponent', () => {
    const memories = [
      { id: 1, text: 'First memory', tags: ['a'] },
      { id: 2, text: 'Second memory longer text', tags: ['b', 'c'] },
      { id: 3, text: 'Third', tags: [] },
    ];

    const theme = {
      fg: (color: string, text: string) => text,
      bold: (text: string) => text,
    };

    it('should render empty state when no memories', () => {
      const comp = new MemoryListComponent([], theme, () => {});
      const lines = comp.render(80);
      expect(lines.join('\n')).toContain('No memories stored');
    });

    it('should render list of memories with IDs and tags', () => {
      const comp = new MemoryListComponent(memories, theme, () => {});
      const lines = comp.render(80).join('\n');
      expect(lines).toContain('#1');
      expect(lines).toContain('First memory');
      expect(lines).toContain('[a]');
      expect(lines).toContain('#2');
      expect(lines).toContain('Second memory');
    });

    it('should truncate long text to 60 characters', () => {
      const longText = 'x'.repeat(100);
      const mem = [{ id: 99, text: longText, tags: [] }];
      const comp = new MemoryListComponent(mem, theme, () => {});
      const lines = comp.render(80).join('\n');
      expect(lines).toContain('x'.repeat(60) + '...');
    });

    it('should show "...and N more" when more than 50 memories', () => {
      const many = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, text: `Mem${i}`, tags: [] }));
      const comp = new MemoryListComponent(many, theme, () => {});
      const lines = comp.render(80).join('\n');
      expect(lines).toContain('...and 10 more.');
    });

    it('should call onClose when Escape is pressed', () => {
      const onClose = vi.fn();
      const comp = new MemoryListComponent([], theme, onClose);
      comp.handleInput(String.fromCharCode(27)); // Escape (ESC)
      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose when Ctrl+C is pressed', () => {
      const onClose = vi.fn();
      const comp = new MemoryListComponent([], theme, onClose);
      comp.handleInput(String.fromCharCode(3)); // Ctrl+C (ETX)
      expect(onClose).toHaveBeenCalled();
    });

    it('should not call onClose for other input', () => {
      const onClose = vi.fn();
      const comp = new MemoryListComponent([], theme, onClose);
      comp.handleInput('a');
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should cache render output for same width', () => {
      const comp = new MemoryListComponent(memories, theme, () => {});
      const first = comp.render(80);
      const second = comp.render(80);
      expect(first === second).toBe(true);
    });

    it('should invalidate cache on invalidate()', () => {
      const comp = new MemoryListComponent(memories, theme, () => {});
      const first = comp.render(80);
      comp.invalidate();
      const second = comp.render(80);
      expect(first === second).toBe(false);
    });
  });

  describe('execute actions', () => {
    const ctx = createMockCtx();

    it('should handle add', async () => {
      const result = await tool.execute('c1', { action: 'add', text: 'New fact', tags: ['test'] }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(api.appendEntry).toHaveBeenCalledWith('memory', expect.objectContaining({ text: 'New fact', tags: ['test'], id: 1 }));
      expect(result.content[0].text).toContain('Stored memory #1');
    });

    it('should handle list after adding', async () => {
      await tool.execute('c1', { action: 'add', text: 'A' }, undefined, undefined, ctx);
      await tool.execute('c2', { action: 'add', text: 'B', tags: ['tag'] }, undefined, undefined, ctx);
      const result = await tool.execute('c3', { action: 'list' }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.details.memories.length).toBe(2);
      const text = result.content[0].text;
      expect(text).toContain('#1');
      expect(text).toContain('A');
      expect(text).toContain('#2');
      expect(text).toContain('B');
    });

    it('should handle get after adding', async () => {
      await tool.execute('c1', { action: 'add', text: 'Target text' }, undefined, undefined, ctx);
      const result = await tool.execute('c2', { action: 'get', id: 1 }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('Target text');
    });

    it('should handle delete after adding', async () => {
      await tool.execute('c1', { action: 'add', text: 'Delete me' }, undefined, undefined, ctx);
      const result = await tool.execute('c2', { action: 'delete', id: 1 }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Deleted memory #1');
      const listResult = await tool.execute('c3', { action: 'list' }, undefined, undefined, ctx);
      expect(listResult.details.memories.length).toBe(0);
    });

    it('should handle search with matches', async () => {
      await tool.execute('c1', { action: 'add', text: 'hello world', tags: [] }, undefined, undefined, ctx);
      const result = await tool.execute('c2', { action: 'search', query: 'hello' }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Found 1 of 1');
      expect(result.content[0].text).toContain('hello world');
    });

    it('should handle search with no matches', async () => {
      await tool.execute('c1', { action: 'add', text: 'goodbye' }, undefined, undefined, ctx);
      const result = await tool.execute('c2', { action: 'search', query: 'nomatch' }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      // Output: "Found 0 of 1 memories:"
      expect(result.content[0].text).toContain('Found 0 of 1');
    });

    it('should handle clear', async () => {
      await tool.execute('c1', { action: 'add', text: 'A' }, undefined, undefined, ctx);
      await tool.execute('c2', { action: 'add', text: 'B' }, undefined, undefined, ctx);
      const result = await tool.execute('c3', { action: 'clear' }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Cleared 2 memories');
      const listResult = await tool.execute('c4', { action: 'list' }, undefined, undefined, ctx);
      expect(listResult.details.memories.length).toBe(0);
    });

    it('should return error for unknown action', async () => {
      const result = await tool.execute('c1', { action: 'unknown' as any }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Unknown action');
      expect(result.details.error).toBeUndefined();
    });

    it('should require text for add action', async () => {
      const result = await tool.execute('c1', { action: 'add' } as any, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('text required');
      expect(result.details.error).toBe('text required');
    });

    it('should handle get with non-existent id', async () => {
      const result = await tool.execute('c1', { action: 'get', id: 999 }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('not found');
      expect(result.details.error).toContain('not found');
    });

    it('should handle delete with non-existent id', async () => {
      const result = await tool.execute('c1', { action: 'delete', id: 999 }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('not found');
      expect(result.details.error).toContain('not found');
    });
  });

  describe('AppendEntry integration', () => {
    it('should persist added memory via appendEntry', async () => {
      const ctx = createMockCtx();
      const result = await tool.execute('c1', { action: 'add', text: 'New fact', tags: ['test'] }, undefined, undefined, ctx);
      expect(api.appendEntry).toHaveBeenCalledWith(
        'memory',
        expect.objectContaining({ text: 'New fact', tags: ['test'], id: 1 })
      );
      expect(result.content[0].text).toContain('Stored memory #1');
    });
  });

  describe('Memory ID sequencing', () => {
    it('should increment IDs across adds', async () => {
      const ctx = createMockCtx();
      await tool.execute('c1', { action: 'add', text: 'A' }, undefined, undefined, ctx);
      await tool.execute('c2', { action: 'add', text: 'B' }, undefined, undefined, ctx);
      const listResult = await tool.execute('c3', { action: 'list' }, undefined, undefined, ctx);
      expect(listResult.details.memories.length).toBe(2);
      expect(listResult.details.memories[0].id).toBe(1);
      expect(listResult.details.memories[1].id).toBe(2);
    });
  });
});
