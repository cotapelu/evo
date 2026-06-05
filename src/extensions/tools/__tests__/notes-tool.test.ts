import { jest } from '@jest/globals';
import { registerNotesTool } from '../notes-tool.js';

function createMockContext() {
  return {} as any;
}

describe('Notes Tool', () => {
  let api: any;
  let tool: any;

  beforeEach(() => {
    api = { registerTool: jest.fn() } as any;
    registerNotesTool(api);
    tool = api.registerTool.mock.calls[0][0];
  });

  test('tool metadata', () => {
    expect(tool.name).toBe('notes');
    expect(tool.label).toBe('Notes');
    expect(tool.description).toContain('scratchpad');
  });

  test('execute: add note', async () => {
    const ctx = createMockContext();
    const result = await tool.execute('1', { action: 'add', text: 'Buy milk' }, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Added note #1');
    expect(result.details.notes).toHaveLength(1);
  });

  test('execute: reject add without text', async () => {
    const ctx = createMockContext();
    const result = await tool.execute('1', { action: 'add' }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.details.error).toBe('text required');
  });

  test('execute: list notes (empty)', async () => {
    const ctx = createMockContext();
    const result = await tool.execute('1', { action: 'list' }, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('No notes');
  });

  test('execute: list notes after add', async () => {
    const ctx = createMockContext();
    await tool.execute('1', { action: 'add', text: 'Note A' }, undefined, undefined, ctx);
    // Need fresh tool? But state stored in WeakMap keyed by ctx, which is same object? Our ctx same empty object each time? The tool uses WeakMap keyed by ctx, so if we reuse same ctx, it shares state. That's okay.
    const result = await tool.execute('2', { action: 'list' }, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('#1: Note A');
    expect(result.details.notes).toHaveLength(1);
  });

  test('execute: clear notes', async () => {
    const ctx = createMockContext();
    await tool.execute('1', { action: 'add', text: 'X' }, undefined, undefined, ctx);
    await tool.execute('2', { action: 'add', text: 'Y' }, undefined, undefined, ctx);
    const clearResult = await tool.execute('3', { action: 'clear' }, undefined, undefined, ctx);
    expect(clearResult.isError).toBe(false);
    expect(clearResult.content[0].text).toBe('Cleared 2 notes');
    const listResult = await tool.execute('4', { action: 'list' }, undefined, undefined, ctx);
    expect(listResult.details.notes).toHaveLength(0);
  });

  test('execute: unknown action', async () => {
    const ctx = createMockContext();
    const result = await tool.execute('1', { action: 'unknown' }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.details.error).toBe('invalid action');
  });

  test('execute: uses JSON string params', async () => {
    const ctx = createMockContext();
    const result = await tool.execute('1', '{"action":"add","text":"JSON test"}', undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Added note #1');
  });

  test('execute: invalid JSON returns error', async () => {
    const ctx = createMockContext();
    const result = await tool.execute('1', '{invalid json}', undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid JSON');
  });

  test('renderCall produces Text', () => {
    const theme = { fg: (c: string, s: string) => s, bold: (s: string) => s };
    const txt = tool.renderCall({ action: 'add' }, theme);
    expect(txt).toBeDefined();
  });

  test('renderResult handles various states', () => {
    const theme = { fg: (c: string, s: string) => s, success: (s: string) => s, warning: (s: string) => s, error: (s: string) => s, dim: (s: any) => s };
    const addResult = tool.renderResult({ details: { action: 'add', notes: [{ id: 1, text: 'hi' }] } }, { expanded: false, isPartial: false }, theme);
    expect(addResult).toBeDefined();
    const listEmpty = tool.renderResult({ details: { action: 'list', notes: [] } }, { expanded: false, isPartial: false }, theme);
    expect(listEmpty).toBeDefined();
    const clear = tool.renderResult({ details: { action: 'clear' } }, { expanded: false, isPartial: false }, theme);
    expect(clear).toBeDefined();
  });
});