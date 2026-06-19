#!/usr/bin/env node
/**
 * Memory Tool Edge Cases
 *
 * Covers error paths and corner cases not exercised in main tests.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock pi-coding-agent: Memory class, logger, etc.
vi.mock('@earendil-works/pi-coding-agent', () => {
  // Memory class behavior: stores entries in a Map
  class Memory {
    id: string;
    entries: Map<string, { content: any }>;
    constructor(id: string) {
      this.id = id;
      this.entries = new Map();
    }
    addEntry(content: any) {
      const id = 'entry-' + Math.random().toString(36).slice(2);
      this.entries.set(id, { content });
      return id;
    }
    getEntry(id: string) { return this.entries.get(id)?.content; }
    deleteEntry(id: string) { return this.entries.delete(id); }
    listEntries() { return Array.from(this.entries.keys()); }
    search(q: string): string[] {
      const results: string[] = [];
      for (const [id, { content }] of this.entries) {
        const text = JSON.stringify(content);
        if (text.includes(q)) results.push(id);
      }
      return results;
    }
    clear() { this.entries.clear(); }
    // workspace-like methods
    set(key: string, value: any, owner: string) { this.entries.set(key, { content: value }); }
    get(key: string) { return this.entries.get(key)?.content; }
    delete(key: string) { return this.entries.delete(key); }
    list() { return Array.from(this.entries.keys()); }
    toObject() { const o: any = {}; for (const [k, v] of this.entries) o[k] = v.content; return o; }
  }
  return { Memory };
});

// Import tool factory after mock
import { createMemoryTool } from '../extensions/tools/memory-tool.js';

function createMockContext(cwd = '/repo') {
  return { cwd };
}

describe('Memory Tool Edge Cases', () => {
  let tool: any;
  let ctx: any;

  beforeEach(() => {
    // Fresh tool instance per test
    tool = createMemoryTool();
    ctx = createMockContext();
  });

  describe('add action', () => {
    it('throws if content is empty', async () => {
      const result = await tool.execute('call-1', {
        action: 'add',
        memory: 'm1',
        content: '',
      }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('content must be non-empty');
    });

    it('throws if content is empty array', async () => {
      const result = await tool.execute('call-1', {
        action: 'add',
        memory: 'm1',
        content: [],
      }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('content must be non-empty');
    });

    it('creates new memory when memory ID does not exist', async () => {
      const result = await tool.execute('call-1', {
        action: 'add',
        memory: 'new-mem',
        content: { text: 'hello' },
      }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.details?.entryId).toBeDefined();
      // The memory should now exist; we can verify by listing entries
      const listResult = await tool.execute('call-2', {
        action: 'list',
        memory: 'new-mem',
      }, undefined, undefined, ctx);
      expect(listResult.isError).toBe(false);
      expect(listResult.details?.entryIds?.length).toBe(1);
    });

    it('adds entry to existing memory', async () => {
      // Add first entry
      await tool.execute('call-1', { action: 'add', memory: 'm1', content: { a: 1 } }, undefined, undefined, ctx);
      // Add second entry
      const result = await tool.execute('call-2', { action: 'add', memory: 'm1', content: { b: 2 } }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      const listResult = await tool.execute('call-3', { action: 'list', memory: 'm1' }, undefined, undefined, ctx);
      expect(listResult.details?.entryIds?.length).toBe(2);
    });
  });

  describe('get action', () => {
    it('returns undefined if entry not found', async () => {
      // Ensure memory doesn't exist
      const result = await tool.execute('call-1', {
        action: 'get',
        memory: 'unknown',
        entryId: 'nonexistent',
      }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.details?.content).toBeUndefined();
    });

    it('retrieves existing entry', async () => {
      // Add entry
      const addResult = await tool.execute('call-1', {
        action: 'add',
        memory: 'm1',
        content: { data: 'test' },
      }, undefined, undefined, ctx);
      const entryId = addResult.details?.entryId;
      const getResult = await tool.execute('call-2', {
        action: 'get',
        memory: 'm1',
        entryId,
      }, undefined, undefined, ctx);
      expect(getResult.isError).toBe(false);
      expect(getResult.details?.content).toEqual({ data: 'test' });
    });
  });

  describe('delete action', () => {
    it('returns false if memory not found', async () => {
      // Delete from non-existent memory: the tool returns isError false and deleted false?
      // Actually code: if (!memory) return { isError: true, ... }? Let's check: In execute, for delete, it gets memory and calls memory.deleteEntry(entryId). If memory not found, it returns error earlier? Let's trust behavior: memory.get returns undefined, then we call .deleteEntry => error. In our implementation, we guard: if (!memory) return error. So we test error.
      const result = await tool.execute('call-1', {
        action: 'delete',
        memory: 'unknown',
        entryId: 'any',
      }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Memory not found');
    });

    it('deletes existing entry', async () => {
      const addResult = await tool.execute('call-1', {
        action: 'add',
        memory: 'm1',
        content: { x: 1 },
      }, undefined, undefined, ctx);
      const entryId = addResult.details?.entryId;
      const delResult = await tool.execute('call-2', {
        action: 'delete',
        memory: 'm1',
        entryId,
      }, undefined, undefined, ctx);
      expect(delResult.isError).toBe(false);
      expect(delResult.details?.deleted).toBe(true);
      // Verify gone
      const getResult = await tool.execute('call-3', {
        action: 'get',
        memory: 'm1',
        entryId,
      }, undefined, undefined, ctx);
      expect(getResult.details?.content).toBeUndefined();
    });
  });

  describe('search action', () => {
    it('returns empty array when no matches', async () => {
      // Add some content
      await tool.execute('call-1', { action: 'add', memory: 'm1', content: { text: 'hello world' } }, undefined, undefined, ctx);
      const result = await tool.execute('call-2', {
        action: 'search',
        memory: 'm1',
        query: 'nonexistent',
      },undefined,undefined,ctx);
      expect(result.isError).toBe(false);
      expect(result.details?.matches?.length).toBe(0);
    });

    it('finds matching entry by content substring', async () => {
      await tool.execute('call-1', { action: 'add', memory: 'm1', content: { msg: 'quick brown fox' } }, undefined, undefined, ctx);
      const result = await tool.execute('call-2', {
        action: 'search',
        memory: 'm1',
        query: 'brown',
      }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.details?.matches?.length).toBe(1);
    });
  });

  describe('list action', () => {
    it('returns empty list when memory empty', async () => {
      const result = await tool.execute('call-1', { action: 'list', memory: 'm1' }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.details?.entryIds?.length).toBe(0);
    });

    it('lists all entry IDs', async () => {
      await tool.execute('call-1', { action: 'add', memory: 'm1', content: { a: 1 } }, undefined, undefined, ctx);
      await tool.execute('call-2', { action: 'add', memory: 'm1', content: { b: 2 } }, undefined, undefined, ctx);
      const result = await tool.execute('call-3', { action: 'list', memory: 'm1' }, undefined, undefined, ctx);
      expect(result.details?.entryIds?.length).toBe(2);
    });
  });

  describe('clear action', () => {
    it('clears all entries in memory', async () => {
      await tool.execute('call-1', { action: 'add', memory: 'm1', content: { a: 1 } }, undefined, undefined, ctx);
      await tool.execute('call-2', { action: 'add', memory: 'm1', content: { b: 2 } }, undefined, undefined, ctx);
      const clearResult = await tool.execute('call-3', { action: 'clear', memory: 'm1' }, undefined, undefined, ctx);
      expect(clearResult.isError).toBe(false);
      const listResult = await tool.execute('call-4', { action: 'list', memory: 'm1' }, undefined, undefined, ctx);
      expect(listResult.details?.entryIds?.length).toBe(0);
    });
  });

  describe('error propagation', () => {
    it('handles thrown exception from underlying memory operation', async () => {
      // We'll simulate by corrupting the memory store to throw on add
      // Since our Memory class is simple, we'll replace the tool's internal getMemory to throw
      const originalGetMemory = (tool as any).getMemory;
      (tool as any).getMemory = () => { throw new Error('DB failure'); };
      const result = await tool.execute('call-1', { action: 'add', memory: 'm1', content: { x: 1 } }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('❌ Error: DB failure');
    });
  });
});
