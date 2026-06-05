import { jest } from '@jest/globals';
import { createStatefulTool } from '../base-tool.js';
import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';

function createMockContext() {
  return {} as any;
}

describe('Base Stateful Tool', () => {
  let api: any;

  beforeEach(() => {
    api = { registerTool: jest.fn() } as any;
  });

  test('creates tool with correct metadata', () => {
    const tool = createStatefulTool({
      name: 'test',
      label: 'Test',
      description: 'Test tool',
      createState: () => ({ count: 0 }),
      execute: async () => ({ content: [{ type: 'text', text: 'ok' }], details: {}, isError: false }),
    });
    expect(tool.name).toBe('test');
    expect(tool.label).toBe('Test');
    expect(tool.description).toBe('Test tool');
  });

  test('createState called once per context', async () => {
    const createState = jest.fn(() => ({ counter: 0 }));
    const tool = createStatefulTool({
      name: 'stateful',
      label: 'Stateful',
      description: 'Stateful tool',
      createState,
      execute: async (toolCallId, params, signal, onUpdate, ctx, state) => {
        state.counter++;
        return { content: [{ type: 'text', text: `counter=${state.counter}` }], details: { counter: state.counter }, isError: false };
      },
    });

    const ctx1 = createMockContext();
    const r1 = await tool.execute('1', {}, undefined, undefined, ctx1);
    expect(createState).toHaveBeenCalledTimes(1);
    expect(r1.details.counter).toBe(1);

    const r2 = await tool.execute('2', {}, undefined, undefined, ctx1);
    expect(createState).toHaveBeenCalledTimes(1); // still only once for same context
    expect(r2.details.counter).toBe(2);

    const ctx2 = createMockContext();
    const r3 = await tool.execute('3', {}, undefined, undefined, ctx2);
    expect(createState).toHaveBeenCalledTimes(2); // new context calls createState again
    expect(r3.details.counter).toBe(1);
  });

  test('mutex serializes concurrent executions', async () => {
    const order: number[] = [];
    const tool = createStatefulTool({
      name: 'ordered',
      label: 'Ordered',
      description: 'Order',
      createState: () => ({}),
      execute: async (toolCallId, params, signal, onUpdate, ctx, state) => {
        // Record entry and exit times to verify serialization
        order.push(parseInt(toolCallId));
        // Simulate some async work
        await new Promise(resolve => setTimeout(resolve, 10));
        order.push(parseInt(toolCallId) * 100); // exit marker
        return { content: [{ type: 'text', text: toolCallId }], details: {}, isError: false };
      },
    });

    const ctx = createMockContext();
    // Run three calls rapidly
    const p1 = tool.execute('1', {}, undefined, undefined, ctx);
    const p2 = tool.execute('2', {}, undefined, undefined, ctx);
    const p3 = tool.execute('3', {}, undefined, undefined, ctx);

    await Promise.all([p1, p2, p3]);

    // The order array should show that each call's entry and exit are contiguous (no interleaving)
    // For call 1: entry 1, exit 100; then call 2 entry 2, exit 200; call 3 entry 3, exit 300.
    expect(order).toEqual([1, 100, 2, 200, 3, 300]);
  });

  test('renderCall and renderResult passed through', () => {
    const renderCall = jest.fn().mockReturnValue(undefined as any);
    const renderResult = jest.fn().mockReturnValue(undefined as any);
    const tool = createStatefulTool({
      name: 'rendered',
      label: 'Rendered',
      description: 'Rendered tool',
      createState: () => ({}),
      execute: async () => ({ content: [], details: {}, isError: false }),
      renderCall,
      renderResult,
    });

    expect(tool.renderCall).toBeDefined();
    expect(tool.renderResult).toBeDefined();

    const theme = {};
    const args = { action: 'test' };
    const ctx = { args: {}, toolCallId: '1', invalidate: () => {}, lastComponent: null } as any;
    tool.renderCall?.(args, theme as any, ctx);
    expect(renderCall).toHaveBeenCalledWith(args, theme, ctx);

    tool.renderResult?.({} as any, { expanded: false, isPartial: false }, theme as any, ctx);
    expect(renderResult).toHaveBeenCalled();
  });
});