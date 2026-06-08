import { jest } from '@jest/globals';
import { registerMemoryTool } from '../memory-tool.js';
// Mock API
function createMockApi() {
    const handlers = {};
    const api = {
        on: jest.fn((event, handler) => {
            handlers[event] = handlers[event] || [];
            handlers[event].push(handler);
        }),
        appendEntry: jest.fn(),
        registerTool: jest.fn((tool) => { api.registeredTool = tool; }),
        getHandlers: () => handlers,
        // For reconstructState: need sessionManager with getBranch
        // Can be overridden per context
    };
    return api;
}
function createMockContext(sessionManager) {
    return {
        sessionManager: sessionManager || {
            getBranch: jest.fn(() => []),
        },
        // other fields not needed
    };
}
describe('Memory Tool', () => {
    let api;
    let tool;
    beforeEach(() => {
        api = createMockApi();
        registerMemoryTool(api);
        tool = api.registeredTool;
        expect(tool).toBeDefined();
        expect(tool.name).toBe('memory');
    });
    describe('State reconstruction from session branch', () => {
        it('rebuilds memories and nextId from toolResult entries', async () => {
            const branchEntries = [
                { type: 'message', message: { role: 'toolResult', toolName: 'memory', details: { memories: [{ id: 1, text: 'first', tags: ['a'] }], nextId: 2 } } },
                { type: 'message', message: { role: 'toolResult', toolName: 'other', details: {} } },
                { type: 'message', message: { role: 'toolResult', toolName: 'memory', details: { memories: [
                                { id: 1, text: 'first', tags: ['a'] },
                                { id: 2, text: 'second' }
                            ], nextId: 3 } } },
            ];
            const ctx = createMockContext({
                getBranch: jest.fn(() => branchEntries),
            });
            // Find session_start handler
            const handlers = api.getHandlers();
            const sessionStart = handlers['session_start'][0];
            expect(sessionStart).toBeDefined();
            await sessionStart(null, ctx);
            // Now perform list to verify state
            const result = await tool.execute('call', { action: 'list' }, undefined, undefined, ctx);
            const details = result.details;
            expect(details.memories.length).toBe(2);
            expect(details.nextId).toBe(3);
        });
    });
    describe('Execute actions', () => {
        let ctx;
        beforeEach(() => {
            ctx = createMockContext({
                getBranch: jest.fn(() => []),
            });
        });
        test('add: stores memory with auto-increment id and appends entry', async () => {
            const result = await tool.execute('1', { action: 'add', text: 'Important fact', tags: ['project'] }, undefined, undefined, ctx);
            expect(result.content[0].text).toContain('Stored memory #1');
            const details = result.details;
            expect(details.memories.length).toBe(1);
            expect(details.memories[0].text).toBe('Important fact');
            expect(details.nextId).toBe(2);
            expect(api.appendEntry).toHaveBeenCalledWith('memory', expect.objectContaining({ id: 1, text: 'Important fact', tags: ['project'] }));
        });
        test('add: fails without text', async () => {
            const result = await tool.execute('1', { action: 'add' }, undefined, undefined, ctx);
            expect(result.content[0].text).toContain('Error: text required for add');
            expect(result.details.error).toBe('text required');
        });
        test('list: returns all memories', async () => {
            await tool.execute('1', { action: 'add', text: 'a' }, undefined, undefined, ctx);
            await tool.execute('2', { action: 'add', text: 'b' }, undefined, undefined, ctx);
            const result = await tool.execute('3', { action: 'list' }, undefined, undefined, ctx);
            const lines = result.content[0].text.split('\n');
            expect(lines.some((l) => l.includes('#1: a'))).toBe(true);
            expect(lines.some((l) => l.includes('#2: b'))).toBe(true);
        });
        test('list: shows no memories message when empty', async () => {
            const result = await tool.execute('1', { action: 'list' }, undefined, undefined, ctx);
            expect(result.content[0].text).toContain('No memories stored.');
        });
        test('get: returns memory text by id', async () => {
            await tool.execute('1', { action: 'add', text: 'secret' }, undefined, undefined, ctx);
            const result = await tool.execute('2', { action: 'get', id: 1 }, undefined, undefined, ctx);
            expect(result.content[0].text).toBe('secret');
        });
        test('get: error if id missing', async () => {
            const result = await tool.execute('1', { action: 'get' }, undefined, undefined, ctx);
            expect(result.content[0].text).toContain('Error: id required for get');
        });
        test('get: not found message', async () => {
            const result = await tool.execute('1', { action: 'get', id: 999 }, undefined, undefined, ctx);
            expect(result.content[0].text).toContain('Memory #999 not found');
        });
        test('delete: removes memory', async () => {
            await tool.execute('1', { action: 'add', text: 'to delete' }, undefined, undefined, ctx);
            const result = await tool.execute('2', { action: 'delete', id: 1 }, undefined, undefined, ctx);
            expect(result.content[0].text).toContain('Deleted memory #1');
            const list = await tool.execute('3', { action: 'list' }, undefined, undefined, ctx);
            expect(list.content[0].text).toContain('No memories');
        });
        test('delete: error if id missing', async () => {
            const result = await tool.execute('1', { action: 'delete' }, undefined, undefined, ctx);
            expect(result.content[0].text).toContain('Error: id required for delete');
        });
        test('clear: removes all memories', async () => {
            await tool.execute('1', { action: 'add', text: 'a' }, undefined, undefined, ctx);
            await tool.execute('2', { action: 'add', text: 'b' }, undefined, undefined, ctx);
            const result = await tool.execute('3', { action: 'clear' }, undefined, undefined, ctx);
            expect(result.content[0].text).toContain('Cleared 2 memories');
            const list = await tool.execute('4', { action: 'list' }, undefined, undefined, ctx);
            expect(list.content[0].text).toContain('No memories');
        });
        test('search: matches text and tags', async () => {
            await tool.execute('1', { action: 'add', text: 'Important decision', tags: ['meeting'] }, undefined, undefined, ctx);
            await tool.execute('2', { action: 'add', text: 'API key stored', tags: ['secret', 'code'] }, undefined, undefined, ctx);
            const result = await tool.execute('3', { action: 'search', query: 'decision' }, undefined, undefined, ctx);
            expect(result.content[0].text).toContain('#1');
            expect(result.content[0].text).not.toContain('#2');
            const result2 = await tool.execute('4', { action: 'search', query: 'secret' }, undefined, undefined, ctx);
            expect(result2.content[0].text).toContain('#2');
        });
        test('search: error without query', async () => {
            const result = await tool.execute('1', { action: 'search' }, undefined, undefined, ctx);
            expect(result.content[0].text).toContain('Error: query required for search');
        });
        test('unknown action returns list as fallback', async () => {
            const result = await tool.execute('1', { action: 'unknown' }, undefined, undefined, ctx);
            expect(result.details.action).toBe('list');
        });
        test('accepts JSON string for params', async () => {
            const result = await tool.execute('1', '{"action":"add","text":"from json"}', undefined, undefined, ctx);
            expect(result.content[0].text).toContain('Stored memory #1');
        });
        test('invalid JSON returns error', async () => {
            const result = await tool.execute('1', '{bad json}', undefined, undefined, ctx);
            expect(result.content[0].text).toContain('Error: Invalid JSON');
        });
        test('multiple sessions isolated', async () => {
            const ctx1 = createMockContext({ getBranch: jest.fn(() => []) });
            const ctx2 = createMockContext({ getBranch: jest.fn(() => []) });
            await tool.execute('1', { action: 'add', text: 'session1' }, undefined, undefined, ctx1);
            const result1 = await tool.execute('2', { action: 'list' }, undefined, undefined, ctx1);
            expect(result1.content[0].text).toContain('#1');
            expect(result1.content[0].text).not.toContain('session2');
            await tool.execute('3', { action: 'add', text: 'session2' }, undefined, undefined, ctx2);
            const result2 = await tool.execute('4', { action: 'list' }, undefined, undefined, ctx2);
            expect(result2.content[0].text).toContain('#1');
            expect(result2.content[0].text).toContain('session2');
            // Back to ctx1 should still only have session1
            const check1 = await tool.execute('5', { action: 'list' }, undefined, undefined, ctx1);
            expect(check1.content[0].text).toContain('session1');
            expect(check1.content[0].text).not.toContain('session2');
        });
    });
});
//# sourceMappingURL=memory-tool.test.js.map