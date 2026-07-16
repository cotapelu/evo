import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock pi-tui
vi.mock('@earendil-works/pi-tui', () => ({
  Text: class Text {
    text: string;
    constructor(text: string, _x: number, _y: number) {
      this.text = text;
    }
  }
}));

// Mock pi-coding-agent to control VERSION
vi.mock('@earendil-works/pi-coding-agent', async () => {
  const actual = await vi.importActual('@earendil-works/pi-coding-agent');
  return {
    ...actual,
    VERSION: '1.0.0-test'
  };
});

import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import piclawHeader from '../../extensions/piclaw-header.js';

// Mock global fetch
global.fetch = vi.fn();

// Mock ui.setHeader capture
let capturedSetHeader: any = null;

function createMockContext({ hasUI = true } = {}): ExtensionContext {
  return {
    hasUI,
    ui: {
      setHeader: (fn: any) => { capturedSetHeader = fn; }
    } as any,
    on: vi.fn(),
    exec: vi.fn(),
    cwd: process.cwd(),
    signal: undefined,
    onUpdate: vi.fn()
  } as any;
}

describe('piclaw-header branch coverage', () => {
  let mockApi: ExtensionAPI;
  let mockCtx: ExtensionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ version: '2.0.0' })
    });
    mockApi = {
      on: vi.fn(),
      registerTool: vi.fn(),
      registerCommand: vi.fn()
    } as any;
    capturedSetHeader = null;
  });

  it('registers session_start handler', () => {
    piclawHeader(mockApi);
    expect(mockApi.on).toHaveBeenCalledWith('session_start', expect.any(Function));
  });

  it('does not set header when ctx.hasUI false', async () => {
    mockCtx = createMockContext({ hasUI: false });
    piclawHeader(mockApi);
    const handler = (mockApi.on as any).mock.calls[0][1];
    await handler('session_start', mockCtx);
    expect(capturedSetHeader).toBeNull();
  });

  it('skips version check when PI_SKIP_VERSION_CHECK set', async () => {
    process.env.PI_SKIP_VERSION_CHECK = 'true';
    mockCtx = createMockContext();
    piclawHeader(mockApi);
    const handler = (mockApi.on as any).mock.calls[0][1];
    await handler('session_start', mockCtx);
    expect(global.fetch).not.toHaveBeenCalled();
    delete process.env.PI_SKIP_VERSION_CHECK;
  });

  it('skips version check when PI_OFFLINE set', async () => {
    process.env.PI_OFFLINE = 'true';
    mockCtx = createMockContext();
    piclawHeader(mockApi);
    const handler = (mockApi.on as any).mock.calls[0][1];
    await handler('session_start', mockCtx);
    expect(global.fetch).not.toHaveBeenCalled();
    delete process.env.PI_OFFLINE;
  });

  it('does not show update when fetch fails', async () => {
    (global.fetch as any).mockRejectedValue(new Error('network error'));
    mockCtx = createMockContext();
    piclawHeader(mockApi);
    const handler = (mockApi.on as any).mock.calls[0][1];
    await handler('session_start', mockCtx);
    expect(capturedSetHeader).toBeDefined();
    // Invoke the header builder to check no update text
    const tui = { fg: (c: string, v: string) => v, bold: (v: string) => v } as any;
    const theme = { fg: (c: string, v: string) => v, bold: (v: string) => v } as any;
    const text = capturedSetHeader(tui, theme).text;
    expect(text).not.toContain('Update Available');
  });

  it('does not show update when response not ok', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false });
    mockCtx = createMockContext();
    piclawHeader(mockApi);
    const handler = (mockApi.on as any).mock.calls[0][1];
    await handler('session_start', mockCtx);
    expect(capturedSetHeader).toBeDefined();
    const tui = { fg: (c: string, v: string) => v, bold: (v: string) => v } as any;
    const theme = { fg: (c: string, v: string) => v, bold: (v: string) => v } as any;
    const text = capturedSetHeader(tui, theme).text;
    expect(text).not.toContain('Update Available');
  });

  it('does not show update when version unchanged', async () => {
    // PI_VERSION mocked as '1.0.0-test'
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ version: '1.0.0-test' })
    });
    mockCtx = createMockContext();
    piclawHeader(mockApi);
    const handler = (mockApi.on as any).mock.calls[0][1];
    await handler('session_start', mockCtx);
    expect(capturedSetHeader).toBeDefined();
    const tui = { fg: (c: string, v: string) => v, bold: (v: string) => v } as any;
    const theme = { fg: (c: string, v: string) => v, bold: (v: string) => v } as any;
    const text = capturedSetHeader(tui, theme).text;
    expect(text).not.toContain('Update Available');
  });

  it('shows update when newer version available', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ version: '9.9.9' })
    });
    mockCtx = createMockContext();
    piclawHeader(mockApi);
    const handler = (mockApi.on as any).mock.calls[0][1];
    await handler('session_start', mockCtx);
    expect(capturedSetHeader).toBeDefined();
    const tui = { fg: (c: string, v: string) => v, bold: (v: string) => v } as any;
    const theme = { fg: (c: string, v: string) => v, bold: (v: string) => v } as any;
    const text = capturedSetHeader(tui, theme).text;
    expect(text).toContain('Update Available');
    expect(text).toContain('9.9.9');
  });
});
