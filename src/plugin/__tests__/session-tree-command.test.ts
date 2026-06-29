#!/usr/bin/env node
/**
 * Session Tree Command Tests
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Global captures for TreeSelectorComponent
let treeSelectorCtorArgs: any[][] = [];
let treeSelectorInstance: any = null;

// Mock pi-coding-agent (DynamicBorder, TreeSelectorComponent)
vi.mock('@earendil-works/pi-coding-agent', () => {
  class DynamicBorder {}
  class TreeSelectorComponent {
    tree: any[];
    constructor(...args: any[]) {
      this.tree = args[0];
      treeSelectorCtorArgs.push(args);
      treeSelectorInstance = this;
    }
    getTreeList() {
      // Return the first node as selected if available
      const selected = this.tree && this.tree[0] ? this.tree[0] : null;
      return { getSelectedNode: () => selected };
    }
    handleInput() {}
  }
  return { DynamicBorder, TreeSelectorComponent };
});

// Mock pi-tui (Container, Text, Spacer)
vi.mock('@earendil-works/pi-tui', () => {
  class Container {
    children: any[] = [];
    addChild(child: any) { this.children.push(child); }
    clear() { this.children = []; }
    render() { return []; }
    invalidate() {}
  }
  class Text {
    constructor(public content: string) {}
  }
  class Spacer {}
  return { Container, Text, Spacer };
});

// Mock widget-helpers used by the command
vi.mock('../utils/widget-helpers.js', () => ({
  addSectionHeader: vi.fn(),
}));

// Import command after mocks are registered
import { registerSessionTreeCommand } from '@extensions/commands/session-tree-command';

function createMockAPI() {
  return { registerCommand: vi.fn() } as any;
}
function createMockTheme() {
  return {
    fg: (_color: string, s: string) => s,
    bold: (s: string) => s,
  };
}

describe('Session Tree Command', () => {
  let api: any;
  let handler: Function;

  beforeEach(() => {
    vi.clearAllMocks();
    treeSelectorCtorArgs = [];
    treeSelectorInstance = null;
    // Mock terminal size
    Object.defineProperty(process.stdout, 'rows', { value: 24, configurable: true });
    Object.defineProperty(process.stdout, 'columns', { value: 80, configurable: true });

    api = createMockAPI();
    registerSessionTreeCommand(api);
    handler = api.registerCommand.mock.calls[0][1].handler;
  });

  it('registers the tree command', () => {
    expect(api.registerCommand).toHaveBeenCalledWith(
      'tree',
      expect.objectContaining({
        description: expect.stringContaining('navigate branches'),
        handler: expect.any(Function),
      })
    );
  });

  it('requires TUI mode', async () => {
    const sessionManager = { getTree: () => [], getLeafId: () => null };
    const ctx = { hasUI: false, sessionManager, ui: { notify: vi.fn() } } as any;
    await handler('', ctx);
    expect(ctx.ui.notify).toHaveBeenCalledWith('/tree requires TUI mode', 'error');
  });

  it('requires sessionManager', async () => {
    const ctx = { hasUI: true, sessionManager: undefined, ui: { notify: vi.fn() } } as any;
    await handler('', ctx);
    expect(ctx.ui.notify).toHaveBeenCalledWith('Session manager not available', 'error');
  });

  it('renders UI with empty tree', async () => {
    const sessionManager = { getTree: () => [], getLeafId: () => null };
    const ctx = { hasUI: true, sessionManager, cwd: '/repo', ui: { custom: vi.fn(), notify: vi.fn() } } as any;
    await handler('', ctx);
    expect(ctx.ui.custom).toHaveBeenCalled();
    const renderFn = ctx.ui.custom.mock.calls[0][0] as Function;
    const tui = { requestRender: vi.fn() };
    const component = renderFn(tui, createMockTheme(), {}, vi.fn());
    expect(component).toBeDefined();
    expect(typeof component.handleInput).toBe('function');
  });

  it('renders UI when sessions exist, showing detail for selected entry', async () => {
    const entry = {
      id: '1',
      parentId: null,
      type: 'message',
      timestamp: Date.now(),
      message: { role: 'user', content: 'hi' },
    } as any;
    const tree = [{ entry, children: [] }];
    const sessionManager = { getTree: () => tree, getLeafId: () => '1' };
    const ctx = {
      hasUI: true,
      sessionManager,
      cwd: '/repo',
      ui: { custom: vi.fn(), notify: vi.fn() },
    } as any;

    await handler('', ctx);

    // Custom UI should be registered
    expect(ctx.ui.custom).toHaveBeenCalled();
    // The first argument of the first call is the render function
    const renderFn = ctx.ui.custom.mock.calls[0][0] as Function;

    // Invoke render callback
    const tui = { requestRender: vi.fn() };
    const theme = createMockTheme();
    const done = vi.fn();
    const component = renderFn(tui, theme, {}, done);

    // TreeSelectorComponent instantiated
    expect(treeSelectorCtorArgs.length).toBeGreaterThanOrEqual(1);

    // Simulate an input event via the component's handleInput to trigger requestRender
    if (component && typeof component.handleInput === 'function') {
      component.handleInput('down');
      expect(tui.requestRender).toHaveBeenCalled();
    }
  });

  it('handles input and updates details on selection change', async () => {
    const entry = {
      id: '1',
      parentId: null,
      type: 'message',
      timestamp: Date.now(),
      message: { role: 'user', content: 'hello' },
    } as any;
    const tree = [{ entry, children: [] }];
    const sessionManager = { getTree: () => tree, getLeafId: () => '1' };
    const ctx = {
      hasUI: true,
      sessionManager,
      cwd: '/repo',
      ui: { custom: vi.fn(), notify: vi.fn() },
    } as any;

    await handler('', ctx);
    const renderFn = ctx.ui.custom.mock.calls[0][0] as Function;
    const tui = { requestRender: vi.fn() };
    const component = renderFn(tui, createMockTheme(), {}, vi.fn());

    // Simulate another input via component.handleInput
    if (component && typeof component.handleInput === 'function') {
      component.handleInput('j');
      expect(tui.requestRender).toHaveBeenCalled();
    }
  });
});
