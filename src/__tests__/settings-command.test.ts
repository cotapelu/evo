#!/usr/bin/env node
/**
 * Settings Command Tests
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// We'll use a var to avoid TDZ issues with vi.mock hoisting
var mockSettingsManager: any;
let capturedSettingsListArgs: any[] = [];

vi.mock('@earendil-works/pi-coding-agent', () => {
  mockSettingsManager = {
    getDefaultModel: vi.fn(),
    getDefaultThinkingLevel: vi.fn(),
    setDefaultModel: vi.fn(),
    setDefaultThinkingLevel: vi.fn(),
  };
  return {
    getAgentDir: vi.fn().mockReturnValue('/agent'),
    SettingsManager: { create: vi.fn().mockReturnValue(mockSettingsManager) },
    getSettingsListTheme: vi.fn().mockReturnValue({}),
  };
});

vi.mock('@earendil-works/pi-tui', () => {
  class Container {
    children: any[] = [];
    addChild(child: any) { this.children.push(child); }
    removeChild(child: any) {
      const idx = this.children.indexOf(child);
      if (idx > -1) this.children.splice(idx, 1);
    }
  }
  class Text { constructor(public content: any) {} }
  class Spacer {}
  class DynamicBorder {}
  class SettingsList {
    constructor(...args: any[]) {
      capturedSettingsListArgs = args;
    }
    handleInput() {}
    updateItems() {} // no-op
  }
  return { Container, Text, Spacer, DynamicBorder, SettingsList };
});

vi.mock('../utils/widget-helpers.js', () => ({
  addSectionHeader: vi.fn(),
}));

// Import after mocks
import { registerSettingsCommand } from '../extensions/commands/settings-command.js';

function createMockAPI() {
  return { registerCommand: vi.fn() } as any;
}
function createMockTheme() {
  return { fg: (c: string, s: string) => s, bold: (s: string) => s };
}

describe('Settings Command', () => {
  let ctx: any;
  let tui: any;
  let renderFn: any;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedSettingsListArgs = [];
    // Reset manager methods to default mocks and provide default returns
    if (mockSettingsManager) {
      mockSettingsManager.getDefaultModel.mockReturnValue('');
      mockSettingsManager.getDefaultThinkingLevel.mockReturnValue('medium');
      mockSettingsManager.setDefaultModel.mockReset();
      mockSettingsManager.setDefaultThinkingLevel.mockReset();
    }
  });

  it('registers command', () => {
    const api = createMockAPI();
    registerSettingsCommand(api);
    expect(api.registerCommand).toHaveBeenCalledWith('settings', expect.objectContaining({
      description: expect.stringContaining('Configure Piclaw settings'),
      handler: expect.any(Function),
    }));
  });

  it('requires TUI mode', async () => {
    const api = createMockAPI();
    registerSettingsCommand(api);
    const handler = api.registerCommand.mock.calls[0][1].handler;
    ctx = { hasUI: false, ui: { notify: vi.fn() } } as any;
    await handler('', ctx);
    expect(ctx.ui.notify).toHaveBeenCalledWith('/settings requires TUI mode', 'error');
  });

  it('builds correct items from settings', async () => {
    const api = createMockAPI();
    registerSettingsCommand(api);
    const handler = api.registerCommand.mock.calls[0][1].handler;
    ctx = { hasUI: true, cwd: '/repo', ui: { custom: vi.fn(), notify: vi.fn() } } as any;

    mockSettingsManager.getDefaultModel.mockReturnValue('gpt-4o');
    mockSettingsManager.getDefaultThinkingLevel.mockReturnValue('medium');

    await handler('', ctx);
    // Extract render callback from ui.custom mock
    renderFn = ctx.ui.custom.mock.calls[0][0];
    tui = { requestRender: vi.fn() };
    const theme = createMockTheme();
    renderFn(tui, theme, {}, vi.fn());

    // Verify captured SettingsList constructor args
    expect(capturedSettingsListArgs.length).toBeGreaterThanOrEqual(4);
    const items = capturedSettingsListArgs[0];
    expect(items).toEqual([
      { id: 'model', label: 'Default Model', currentValue: 'gpt-4o', values: expect.any(Array) },
      { id: 'thinking', label: 'Thinking Level', currentValue: 'medium', values: expect.any(Array) },
    ]);
    const onEdit = capturedSettingsListArgs[3];
    expect(typeof onEdit).toBe('function');
  });

  it('calls setDefaultModel on model edit', async () => {
    const api = createMockAPI();
    registerSettingsCommand(api);
    const handler = api.registerCommand.mock.calls[0][1].handler;
    ctx = { hasUI: true, cwd: '/repo', ui: { custom: vi.fn(), notify: vi.fn() } } as any;

    mockSettingsManager.getDefaultModel.mockReturnValue('');
    mockSettingsManager.getDefaultThinkingLevel.mockReturnValue('medium');

    await handler('', ctx);
    renderFn = ctx.ui.custom.mock.calls[0][0];
    tui = { requestRender: vi.fn() };
    renderFn(tui, createMockTheme(), {}, vi.fn());

    const onEdit = capturedSettingsListArgs[3];
    // Invoke edit for model
    onEdit('model', 'openai:gpt-4o');

    expect(mockSettingsManager.setDefaultModel).toHaveBeenCalledWith('openai:gpt-4o');
    // The onEdit should notify saved
    expect(ctx.ui.notify).toHaveBeenCalledWith('Saved model = openai:gpt-4o', 'info');
    // It should also recreate settingsList and request render
    expect(tui.requestRender).toHaveBeenCalled();
  });

  it('falls back to medium for invalid thinking level', async () => {
    const api = createMockAPI();
    registerSettingsCommand(api);
    const handler = api.registerCommand.mock.calls[0][1].handler;
    ctx = { hasUI: true, cwd: '/repo', ui: { custom: vi.fn(), notify: vi.fn() } } as any;

    mockSettingsManager.getDefaultModel.mockReturnValue('gpt-4o');
    mockSettingsManager.getDefaultThinkingLevel.mockReturnValue('medium');

    await handler('', ctx);
    renderFn = ctx.ui.custom.mock.calls[0][0];
    tui = { requestRender: vi.fn() };
    renderFn(tui, createMockTheme(), {}, vi.fn());

    const onEdit = capturedSettingsListArgs[3];
    onEdit('thinking', 'invalid');

    expect(mockSettingsManager.setDefaultThinkingLevel).toHaveBeenCalledWith('medium');
    // The notify uses the user-provided value, not the fallback
    expect(ctx.ui.notify).toHaveBeenCalledWith('Saved thinking = invalid', 'info');
  });

  it('handles setDefaultModel error synchronously', async () => {
    const api = createMockAPI();
    registerSettingsCommand(api);
    const handler = api.registerCommand.mock.calls[0][1].handler;
    ctx = { hasUI: true, cwd: '/repo', ui: { custom: vi.fn(), notify: vi.fn() } } as any;

    mockSettingsManager.getDefaultModel.mockReturnValue('');
    mockSettingsManager.getDefaultThinkingLevel.mockReturnValue('medium');
    mockSettingsManager.setDefaultModel.mockImplementation(() => {
      throw new Error('Disk full');
    });

    await handler('', ctx);
    renderFn = ctx.ui.custom.mock.calls[0][0];
    tui = { requestRender: vi.fn() };
    renderFn(tui, createMockTheme(), {}, vi.fn());

    const onEdit = capturedSettingsListArgs[3];
    onEdit('model', 'bad');

    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Failed to save model'), 'error');
  });
});
