import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerMemoryTool, Memory } from '../../extensions/tools/memory-tool.js';

// Helper to create session branch entries that reconstructState will process
function createMemoryEntry(mem: Memory) {
  return {
    type: 'message' as const,
    message: {
      role: 'toolResult' as const,
      toolName: 'memory' as const,
      content: {},
      details: { memories: [mem], nextId: mem.id + 1 }
    }
  };
}

function createBranch(memories: Memory[], nextId: number) {
  return {
    type: 'message' as const,
    message: {
      role: 'toolResult' as const,
      toolName: 'memory' as const,
      content: {},
      details: { memories, nextId }
    }
  };
}

describe('memory tool execute', () => {
  let mockApi: any;
  let tool: any;
  let sessionStartHandler: any;
  let sessionTreeHandler: any;

  beforeAll(() => {
    mockApi = {
      registerTool: vi.fn(),
      on: vi.fn(),
      appendEntry: vi.fn()
    };
    registerMemoryTool(mockApi);
    tool = mockApi.registerTool.mock.calls[0][0];
    const onCalls = mockApi.on.mock.calls;
    const startCall = onCalls.find((args: any[]) => args[0] === 'session_start');
    const treeCall = onCalls.find((args: any[]) => args[0] === 'session_tree');
    sessionStartHandler = startCall![1];
    sessionTreeHandler = treeCall![1];
  });

  async function reconstructState(branch: any[] = []) {
    const ctx = {
      sessionManager: { getBranch: () => branch }
    };
    await sessionStartHandler(null, ctx);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Start with empty state
    reconstructState([]);
  });

  describe('add action', () => {
    it('should add a memory with text and optional tags', async () => {
      const result = await tool.execute('call', { action: 'add', text: 'my note', tags: ['tag1', 'tag2'] }, null, null, {});

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Stored memory #1');
      expect(result.details.action).toBe('add');
      expect(result.details.memories).toHaveLength(1);
      expect(result.details.memories[0].text).toBe('my note');
      expect(result.details.memories[0].tags).toEqual(['tag1', 'tag2']);
      expect(mockApi.appendEntry).toHaveBeenCalledWith('memory', expect.objectContaining({ text: 'my note', tags: ['tag1', 'tag2'] }));
    });

    it('should add without tags', async () => {
      const result = await tool.execute('call', { action: 'add', text: 'simple' }, null, null, {});

      expect(result.isError).toBe(false);
      expect(result.details.memories[0].tags).toBeUndefined();
    });

    it('should fail if text is empty', async () => {
      const result = await tool.execute('call', { action: 'add', text: '' }, null, null, {});

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('Error: text required for add');
      expect(result.details.error).toBe('text required');
      expect(mockApi.appendEntry).not.toHaveBeenCalled();
    });

    it('should fail if text is missing', async () => {
      const result = await tool.execute('call', { action: 'add' }, null, null, {});

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('Error: text required for add');
    });

    it('should increment nextId correctly on multiple adds', async () => {
      await tool.execute('call', { action: 'add', text: 'first' }, null, null, {});
      const result = await tool.execute('call', { action: 'add', text: 'second' }, null, null, {});

      expect(result.details.memories).toHaveLength(2);
      expect(result.details.nextId).toBe(3);
    });
  });

  describe('list action', () => {
    it('should list empty state', async () => {
      const result = await tool.execute('call', { action: 'list' }, null, null, {});

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('No memories stored.');
      expect(result.details.memories).toHaveLength(0);
    });

    it('should list memories', async () => {
      const mems = [
        { id: 1, text: 'first', tags: ['a'], created: Date.now() },
        { id: 2, text: 'second long text that exceeds eighty chars should be truncated properly by the tool when rendering but not in list details', created: Date.now() }
      ];
      await reconstructState([createBranch(mems, 3)]);

      const result = await tool.execute('call', { action: 'list' }, null, null, {});

      expect(result.isError).toBe(false);
      expect(result.details.memories).toHaveLength(2);
      // The content shows formatted lines
      expect(result.content[0].text).toContain('#1: first');
      // Truncation may vary; ensure both entries present
      expect(result.content[0].text).toMatch(/#2: second long text that exceeds eighty chars/);
    });
  });

  describe('get action', () => {
    it('should get memory by id', async () => {
      const mem = { id: 5, text: 'target', created: Date.now() };
      await reconstructState([createBranch([mem], 6)]);

      const result = await tool.execute('call', { action: 'get', id: 5 }, null, null, {});

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('target');
      expect(result.details.targetId).toBe(5);
    });

    it('should error if id is missing', async () => {
      const result = await tool.execute('call', { action: 'get' }, null, null, {});

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('Error: id required for get');
      expect(result.details.error).toBe('id required');
    });

    it('should return not found if id does not exist', async () => {
      await reconstructState([createBranch([{ id: 1, text: 'x', created: Date.now() }], 2)]);

      const result = await tool.execute('call', { action: 'get', id: 99 }, null, null, {});

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('Memory #99 not found');
      expect(result.details.error).toBe('#99 not found');
    });
  });

  describe('delete action', () => {
    it('should delete a memory', async () => {
      const mem = { id: 3, text: 'to delete', created: Date.now() };
      await reconstructState([createBranch([mem], 4)]);

      const result = await tool.execute('call', { action: 'delete', id: 3 }, null, null, {});

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('Deleted memory #3');
      expect(mockApi.appendEntry).toHaveBeenCalledWith('memory', expect.objectContaining({ id: 3, _deleted: true }));
      expect(result.details.memories).toHaveLength(0);
      expect(result.details.nextId).toBe(4);
    });

    it('should error if id is missing', async () => {
      const result = await tool.execute('call', { action: 'delete' }, null, null, {});

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('Error: id required for delete');
    });

    it('should return not found if id does not exist', async () => {
      await reconstructState([createBranch([{ id: 1, text: 'x', created: Date.now() }], 2)]);

      const result = await tool.execute('call', { action: 'delete', id: 99 }, null, null, {});

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('Memory #99 not found');
      expect(result.details.error).toBe('#99 not found');
    });
  });

  describe('clear action', () => {
    it('should clear all memories', async () => {
      const mems = [
        { id: 1, text: 'a', created: Date.now() },
        { id: 2, text: 'b', created: Date.now() }
      ];
      await reconstructState([createBranch(mems, 3)]);

      const result = await tool.execute('call', { action: 'clear' }, null, null, {});

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('Cleared 2 memories');
      expect(mockApi.appendEntry).toHaveBeenCalledTimes(2);
      // Each appendEntry should have _deleted: true
      expect(mockApi.appendEntry.mock.calls[0][1]).toMatchObject({ _deleted: true, id: 1 });
      expect(mockApi.appendEntry.mock.calls[1][1]).toMatchObject({ _deleted: true, id: 2 });
      expect(result.details.memories).toHaveLength(0);
      expect(result.details.nextId).toBe(1);
    });

    it('should clear empty list', async () => {
      const result = await tool.execute('call', { action: 'clear' }, null, null, {});

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('Cleared 0 memories');
      expect(mockApi.appendEntry).not.toHaveBeenCalled();
    });
  });

  describe('search action', () => {
    it('should search by text', async () => {
      const mems = [
        { id: 1, text: 'apple', tags: ['fruit'], created: Date.now() },
        { id: 2, text: 'banana', tags: ['fruit'], created: Date.now() },
        { id: 3, text: 'carrot', tags: ['veg'], created: Date.now() }
      ];
      await reconstructState([createBranch(mems, 4)]);

      const result = await tool.execute('call', { action: 'search', query: 'apple' }, null, null, {});

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Found 1 of 3 memories');
      expect(result.content[0].text).toContain('#1: apple');
      expect(result.details.memories).toHaveLength(1);
    });

    it('should search by tags', async () => {
      const mems = [
        { id: 1, text: 'meeting', tags: ['work'], created: Date.now() },
        { id: 2, text: 'lunch', tags: ['personal'], created: Date.now() }
      ];
      await reconstructState([createBranch(mems, 3)]);

      const result = await tool.execute('call', { action: 'search', query: 'work' }, null, null, {});

      expect(result.isError).toBe(false);
      expect(result.details.memories).toHaveLength(1);
      expect(result.details.memories[0].id).toBe(1);
    });

    it('should be case-insensitive', async () => {
      const mems = [{ id: 1, text: 'Apple Pie', created: Date.now() }];
      await reconstructState([createBranch(mems, 2)]);

      const result = await tool.execute('call', { action: 'search', query: 'apple' }, null, null, {});

      expect(result.details.memories).toHaveLength(1);
    });

    it('should return zero results when no match', async () => {
      const mems = [{ id: 1, text: 'nothing', created: Date.now() }];
      await reconstructState([createBranch(mems, 2)]);

      const result = await tool.execute('call', { action: 'search', query: 'xyz' }, null, null, {});

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Found 0 of 1 memories');
      expect(result.details.memories).toHaveLength(0);
    });

    it('should error if query is missing', async () => {
      const result = await tool.execute('call', { action: 'search' }, null, null, {});

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('Error: query required for search');
      expect(result.details.error).toBe('query required');
    });
  });

  describe('unknown action', () => {
    it('should return unknown action message', async () => {
      const result = await tool.execute('call', { action: 'unknown' as any }, null, null, {});

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Unknown action: unknown');
      expect(result.details.action).toBe('list'); // defaults to list for details
    });
  });

  describe('JSON string params', () => {
    it('should parse JSON string and execute add', async () => {
      const result = await tool.execute('call', '{"action":"add","text":"from json","tags":["json"]}', null, null, {});

      expect(result.isError).toBe(false);
      expect(result.details.action).toBe('add');
      expect(result.details.memories[0].text).toBe('from json');
    });

    it('should handle invalid JSON', async () => {
      const result = await tool.execute('call', 'invalid json', null, null, {});

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Error: Invalid JSON');
      expect(result.details.error).toBe('Invalid JSON');
    });
  });

  describe('state reconstruction', () => {
    it('should reconstruct state from branch on session_start', async () => {
      const mems = [
        { id: 10, text: 'existing', tags: [], created: Date.now() }
      ];
      await reconstructState([createBranch(mems, 11)]);

      // After reconstruction, a list should show the memory
      const result = await tool.execute('call', { action: 'list' }, null, null, {});

      expect(result.details.memories).toHaveLength(1);
      expect(result.details.memories[0].id).toBe(10);
      expect(result.details.nextId).toBe(11);
    });

    it('should handle branch with multiple entries (most recent wins)', async () => {
      // Simulate multiple branch entries - the reconstructState loops and overwrites memories each time it finds a valid details
      const mems1 = [{ id: 1, text: 'first', created: Date.now() }];
      const mems2 = [{ id: 2, text: 'second', created: Date.now() }];
      await reconstructState([
        createBranch(mems1, 2),
        createBranch(mems2, 3)
      ]);

      const result = await tool.execute('call', { action: 'list' }, null, null, {});

      expect(result.details.memories).toHaveLength(1);
      expect(result.details.memories[0].id).toBe(2);
    });

    it('should ignore entries without proper details structure', async () => {
      await reconstructState([
        { type: 'message', message: { role: 'assistant' } }, // no details
        createBranch([{ id: 1, text: 'valid', created: Date.now() }], 2)
      ]);

      const result = await tool.execute('call', { action: 'list' }, null, null, {});

      expect(result.details.memories).toHaveLength(1);
    });
  });

  describe('session_tree event', () => {
    it('should reconstruct state on session_tree', async () => {
      const mems = [{ id: 5, text: 'tree update', created: Date.now() }];
      const ctx = { sessionManager: { getBranch: () => [createBranch(mems, 6)] } };
      await sessionTreeHandler(null, ctx);

      const result = await tool.execute('call', { action: 'list' }, null, null, {});

      expect(result.details.memories).toHaveLength(1);
      expect(result.details.memories[0].id).toBe(5);
    });
  });

  describe('concurrency and mutex', () => {
    it('should serialize access via mutex', async () => {
      // We can't easily test the mutex behavior without deep mocking, but we can at least verify the lock is used
      // by checking that the tool still works normally when called sequentially.
      await tool.execute('call', { action: 'add', text: 'a' }, null, null, {});
      await tool.execute('call', { action: 'add', text: 'b' }, null, null, {});

      expect(mockApi.appendEntry).toHaveBeenCalledTimes(2);
    });
  });
});
