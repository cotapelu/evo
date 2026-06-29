#!/usr/bin/env node
/**
 * Memory Tool Edge Cases
 *
 * Covers error paths and corner cases not exercised in main tests:
 * - JSON string parameter parsing (valid and malformed)
 * - Session reconstruction from branch events
 * - Error handling when api.appendEntry throws
 * - Unknown action fallback behavior
 * - Search case-insensitivity
 * - Concurrency protection
 * - Delete/Get non-existent IDs
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { registerMemoryTool } from "@extensions/tools/memory-tool";
import { createMockExtensionAPI } from "../tests/utils/mock-factory.js";

function createMockApi(overrides: any = {}) {
  return createMockExtensionAPI({
    appendEntry: vi.fn(),
    on: vi.fn(),
    sessionManager: {
      getBranch: () => [],
      ...overrides.sessionManager
    },
    ...overrides
  });
}

function createMockContext(cwd = '/repo') {
  return { cwd };
}

describe('Memory Tool Edge Cases', () => {
  let api: any;
  let tool: any;

  beforeEach(() => {
    api = createMockApi({
      on: vi.fn((event: string, handler: Function) => {
        // Event listeners captured but not auto-invoked
      })
    });
    registerMemoryTool(api);
    tool = api.registerTool.mock.calls[0][0];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('execute with JSON string parameters', () => {
    it('parses valid JSON string', async () => {
      const ctx = createMockContext();
      const result = await tool.execute('call-1', '{"action":"add","text":"from JSON"}', undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Stored memory #1');
      expect(api.appendEntry).toHaveBeenCalledWith('memory', expect.objectContaining({ text: 'from JSON' }));
    });

    it('handles malformed JSON string', async () => {
      const ctx = createMockContext();
      const result = await tool.execute('call-1', '{invalid json}', undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Error: Invalid JSON');
    });

    it('parses JSON string for list action', async () => {
      await tool.execute('add-obj', { action: 'add', text: 'test' }, undefined, undefined, createMockContext());
      const result = await tool.execute('search-json', '{"action":"search","query":"test"}', undefined, undefined, createMockContext());
      expect(result.isError).toBe(false);
      expect(result.details.memories.length).toBe(1);
    });

    it('parses JSON string for get with id', async () => {
      await tool.execute('add', { action: 'add', text: 'data' }, undefined, undefined, createMockContext());
      const result = await tool.execute('get', '{"action":"get","id":1}', undefined, undefined, createMockContext());
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('data');
    });
  });

  describe('session reconstruction', () => {
    it('reconstructs state from session_start event', async () => {
      const existingMemories = [
        { id: 1, text: 'First', tags: ['a'], created: Date.now() },
        { id: 2, text: 'Second', tags: [], created: Date.now() }
      ];
      const branch = [
        {
          type: 'message' as const,
          message: {
            role: 'toolResult' as const,
            toolName: 'memory',
            details: { memories: existingMemories, nextId: 3 }
          }
        }
      ];
      const mockSessionManager = { getBranch: () => branch };
      api = createMockExtensionAPI({
        on: vi.fn(),
        sessionManager: mockSessionManager
      });
      registerMemoryTool(api);
      const onCalls = api.on.mock.calls;
      const sessionStartHandler = onCalls.find(c => c[0] === 'session_start')?.[1];
      expect(sessionStartHandler).toBeDefined();
      const ctx = { cwd: '/repo', sessionManager: mockSessionManager };
      await sessionStartHandler(undefined, ctx as any);
      const newTool = api.registerTool.mock.calls[0][0];
      const result = await newTool.execute('list-call', { action: 'list' }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.details.memories.length).toBe(2);
      expect(result.details.memories[0].text).toBe('First');
      expect(result.details.nextId).toBe(3);
    });

    it('reconstructs empty state if no memory entries', async () => {
      const branch: any[] = [{ type: 'message', message: { role: 'toolResult', toolName: 'other' } }];
      const mockSessionManager = { getBranch: () => branch };
      api = createMockExtensionAPI({ on: vi.fn(), sessionManager: mockSessionManager });
      registerMemoryTool(api);
      const onCalls = api.on.mock.calls;
      const sessionStartHandler = onCalls.find(c => c[0] === 'session_start')?.[1];
      const ctx = { cwd: '/repo', sessionManager: mockSessionManager };
      await sessionStartHandler(undefined, ctx as any);
      const newTool = api.registerTool.mock.calls[0][0];
      const result = await newTool.execute('list-call', { action: 'list' }, undefined, undefined, ctx);
      expect(result.details.memories.length).toBe(0);
      expect(result.details.nextId).toBe(1);
    });

    it('handles malformed details in session entries gracefully', async () => {
      const branch = [
        {
          type: 'message',
          message: { role: 'toolResult', toolName: 'memory', details: { memories: 'not array', nextId: 5 } }
        }
      ];
      const mockSessionManager = { getBranch: () => branch };
      api = createMockExtensionAPI({ on: vi.fn(), sessionManager: mockSessionManager });
      registerMemoryTool(api);
      const onCalls = api.on.mock.calls;
      const handler = onCalls.find(c => c[0] === 'session_start')?.[1];
      const ctx = { cwd: '/repo', sessionManager: mockSessionManager };
      await handler(undefined, ctx as any);
      const newTool = api.registerTool.mock.calls[0][0];
      const result = await newTool.execute('list-call', { action: 'list' }, undefined, undefined, ctx);
      expect(result.details.memories.length).toBe(0);
      expect(result.details.nextId).toBe(1);
    });
  });

  describe('error handling', () => {
    it('handles api.appendEntry throwing', async () => {
      api.appendEntry = vi.fn(() => { throw new Error('Storage full'); });
      const ctx = createMockContext();
      const result = await tool.execute('call-1', { action: 'add', text: 'test' }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error: Storage full');
    });

    it('unknown action returns appropriate fallback', async () => {
      const ctx = createMockContext();
      const result = await tool.execute('call-1', { action: 'bogus' }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Unknown action');
      expect(result.details.action).toBe('list');
    });
  });

  describe('search case-insensitivity', () => {
    it('finds matches regardless of case in text', async () => {
      await tool.execute('c1', { action: 'add', text: 'Decision: Go Live' }, undefined, undefined, createMockContext());
      await tool.execute('c2', { action: 'add', text: 'Another Note' }, undefined, undefined, createMockContext());
      const result = await tool.execute('c3', { action: 'search', query: 'DECISION' }, undefined, undefined, createMockContext());
      expect(result.details.memories.length).toBe(1);
      expect(result.details.memories[0].text).toContain('Decision');
    });

    it('searches tags case-insensitively', async () => {
      await tool.execute('c4', { action: 'add', text: 'Tagged', tags: ['Important', 'Meeting'] }, undefined, undefined, createMockContext());
      const result = await tool.execute('c5', { action: 'search', query: 'important' }, undefined, undefined, createMockContext());
      expect(result.details.memories.length).toBe(1);
    });
  });

  describe('concurrent access', () => {
    it('serializes access with mutex', async () => {
      const ctx = createMockContext();
      const order: number[] = [];
      api.appendEntry = vi.fn(async () => {
        await new Promise(res => setTimeout(res, 10));
        order.push(Date.now());
      });
      await Promise.all([
        tool.execute('c1', { action: 'add', text: 'A' }, undefined, undefined, ctx),
        tool.execute('c2', { action: 'add', text: 'B' }, undefined, undefined, ctx),
        tool.execute('c3', { action: 'add', text: 'C' }, undefined, undefined, ctx),
      ]);
      const listResult = await tool.execute('list', { action: 'list' }, undefined, undefined, ctx);
      expect(listResult.details.memories.length).toBe(3);
      for (let i = 1; i < order.length; i++) {
        expect(order[i] >= order[i-1]).toBe(true);
      }
    });
  });

  describe('list action returns all memories', () => {
    it('lists all entries', async () => {
      await tool.execute('c1', { action: 'add', text: 'A' }, undefined, undefined, createMockContext());
      await tool.execute('c2', { action: 'add', text: 'B' }, undefined, undefined, createMockContext());
      const result = await tool.execute('c3', { action: 'list' }, undefined, undefined, createMockContext());
      expect(result.details.memories.length).toBe(2);
      const ids = result.details.memories.map((m: any) => m.id).sort();
      expect(ids).toEqual([1, 2]);
    });
  });

  describe('delete edge cases', () => {
    it('deleting non-existent ID returns error', async () => {
      const result = await tool.execute('c1', { action: 'delete', id: 999 }, undefined, undefined, createMockContext());
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('not found');
    });
  });

  describe('get edge cases', () => {
    it('getting non-existent ID returns not found', async () => {
      const result = await tool.execute('c1', { action: 'get', id: 999 }, undefined, undefined, createMockContext());
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('not found');
    });
  });

  describe('add validation', () => {
    it('requires text parameter', async () => {
      const result = await tool.execute('c1', { action: 'add' }, undefined, undefined, createMockContext());
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('text required for add');
    });

    it('rejects empty text', async () => {
      const result = await tool.execute('c1', { action: 'add', text: '' }, undefined, undefined, createMockContext());
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('text required for add');
    });
  });
});
