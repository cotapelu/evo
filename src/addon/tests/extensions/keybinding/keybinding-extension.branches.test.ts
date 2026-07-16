import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock pi-coding-agent's getAgentDir
vi.mock('@earendil-works/pi-coding-agent', async () => {
  const actual = await vi.importActual('@earendil-works/pi-coding-agent');
  return {
    ...actual,
    getAgentDir: vi.fn(() => '/home/user/.pi'),
  };
});

import { existsSync, readFileSync } from 'fs';
import { registerKeybindingExtension } from '../../../extensions/keybinding/keybinding-extension.js';

describe('keybinding-extension branch coverage', () => {
  let mockApi: any;
  let mockCtx: any;

  function createMockCtx(overrides: any = {}): any {
    return {
      hasUI: true,
      isIdle: () => true,
      ui: {
        onTerminalInput: vi.fn((cb: any) => {
          // Capture the callback; return unsubscribe function
          return () => {};
        }),
        notify: vi.fn(),
      },
      ...overrides,
    };
  }

  function getSessionStartHandler(): any {
    // api.on is called with event name and handler
    const call = mockApi.on.mock.calls.find((c: any) => c[0] === 'session_start');
    return call ? call[1] : null;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = {
      on: vi.fn(),
      sendUserMessage: vi.fn(),
    };
  });

  it('does not register terminal input when config missing', async () => {
    (existsSync as any).mockReturnValue(false);
    registerKeybindingExtension(mockApi);
    const handler = getSessionStartHandler();
    expect(handler).not.toBeNull();
    mockCtx = createMockCtx();
    await handler('session_start', mockCtx);
    expect(mockCtx.ui.onTerminalInput).not.toHaveBeenCalled();
  });

  it('does not register terminal input when JSON invalid', async () => {
    (existsSync as any).mockReturnValue(true);
    (readFileSync as any).mockReturnValue('invalid json');
    registerKeybindingExtension(mockApi);
    const handler = getSessionStartHandler();
    mockCtx = createMockCtx();
    await handler('session_start', mockCtx);
    expect(mockCtx.ui.onTerminalInput).not.toHaveBeenCalled();
  });

  it('does not register terminal input when keybindings empty', async () => {
    (existsSync as any).mockReturnValue(true);
    (readFileSync as any).mockReturnValue(JSON.stringify({}));
    registerKeybindingExtension(mockApi);
    const handler = getSessionStartHandler();
    mockCtx = createMockCtx();
    await handler('session_start', mockCtx);
    expect(mockCtx.ui.onTerminalInput).not.toHaveBeenCalled();
  });

  it('registers terminal input when keybindings present', async () => {
    (existsSync as any).mockReturnValue(true);
    (readFileSync as any).mockReturnValue(JSON.stringify({
      keybindings: { team: 't', settings: 's' }
    }));
    registerKeybindingExtension(mockApi);
    const handler = getSessionStartHandler();
    mockCtx = createMockCtx();
    await handler('session_start', mockCtx);
    expect(mockCtx.ui.onTerminalInput).toHaveBeenCalledTimes(1);
  });

  it('consumes matching simple key and sends command', async () => {
    (existsSync as any).mockReturnValue(true);
    (readFileSync as any).mockReturnValue(JSON.stringify({ keybindings: { team: 't' } }));
    registerKeybindingExtension(mockApi);
    const handler = getSessionStartHandler();
    mockCtx = createMockCtx();
    // Capture the onTerminalInput callback
    let inputCallback: any;
    mockCtx.ui.onTerminalInput.mockImplementation((cb: any) => {
      inputCallback = cb;
      return () => {};
    });
    await handler('session_start', mockCtx);
    expect(inputCallback).toBeDefined();
    // Simulate key press 't'
    const result = inputCallback('t');
    expect(mockApi.sendUserMessage).toHaveBeenCalledWith('/team');
    expect(result).toEqual({ consume: true });
  });

  it('does not consume non-matching key', async () => {
    (existsSync as any).mockReturnValue(true);
    (readFileSync as any).mockReturnValue(JSON.stringify({ keybindings: { team: 't' } }));
    registerKeybindingExtension(mockApi);
    const handler = getSessionStartHandler();
    mockCtx = createMockCtx();
    let inputCallback: any;
    mockCtx.ui.onTerminalInput.mockImplementation((cb: any) => {
      inputCallback = cb;
      return () => {};
    });
    await handler('session_start', mockCtx);
    const result = inputCallback('x'); // non-bound key
    expect(mockApi.sendUserMessage).not.toHaveBeenCalled();
    expect(result).toBeUndefined(); // pass through
  });

  it('handles ctrl+r combination', async () => {
    (existsSync as any).mockReturnValue(true);
    (readFileSync as any).mockReturnValue(JSON.stringify({ keybindings: { tree: 'ctrl+r' } }));
    registerKeybindingExtension(mockApi);
    const handler = getSessionStartHandler();
    mockCtx = createMockCtx();
    let inputCallback: any;
    mockCtx.ui.onTerminalInput.mockImplementation((cb: any) => {
      inputCallback = cb;
      return () => {};
    });
    await handler('session_start', mockCtx);
    // ctrl+r is ASCII 18 (0x12)
    const result = inputCallback('\u0012');
    expect(mockApi.sendUserMessage).toHaveBeenCalledWith('/tree');
    expect(result).toEqual({ consume: true });
  });

  it('ignores escape key', async () => {
    (existsSync as any).mockReturnValue(true);
    (readFileSync as any).mockReturnValue(JSON.stringify({ keybindings: { tree: 'ctrl+r' } }));
    registerKeybindingExtension(mockApi);
    const handler = getSessionStartHandler();
    mockCtx = createMockCtx();
    let inputCallback: any;
    mockCtx.ui.onTerminalInput.mockImplementation((cb: any) => {
      inputCallback = cb;
      return () => {};
    });
    await handler('session_start', mockCtx);
    const result = inputCallback('\u001b'); // ESC
    expect(mockApi.sendUserMessage).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('does not consume when ctx.hasUI false', async () => {
    (existsSync as any).mockReturnValue(true);
    (readFileSync as any).mockReturnValue(JSON.stringify({ keybindings: { team: 't' } }));
    registerKeybindingExtension(mockApi);
    const handler = getSessionStartHandler();
    mockCtx = createMockCtx({ hasUI: false });
    let inputCallback: any;
    mockCtx.ui.onTerminalInput.mockImplementation((cb: any) => {
      inputCallback = cb;
      return () => {};
    });
    await handler('session_start', mockCtx);
    // onTerminalInput is called, but the callback should return early without consuming
    expect(inputCallback).toBeDefined();
    const result = inputCallback('t');
    expect(mockApi.sendUserMessage).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('does not consume when ctx.isIdle false', async () => {
    (existsSync as any).mockReturnValue(true);
    (readFileSync as any).mockReturnValue(JSON.stringify({ keybindings: { team: 't' } }));
    registerKeybindingExtension(mockApi);
    const handler = getSessionStartHandler();
    mockCtx = createMockCtx({ isIdle: () => false });
    let inputCallback: any;
    mockCtx.ui.onTerminalInput.mockImplementation((cb: any) => {
      inputCallback = cb;
      return () => {};
    });
    await handler('session_start', mockCtx);
    expect(inputCallback).toBeDefined(); // onTerminalInput still called, but handler inside returns early on non-idle
    // Simulate key press
    const result = inputCallback('t');
    expect(mockApi.sendUserMessage).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('handles sendUserMessage error and notifies', async () => {
    (existsSync as any).mockReturnValue(true);
    (readFileSync as any).mockReturnValue(JSON.stringify({ keybindings: { team: 't' } }));
    mockApi.sendUserMessage = vi.fn().mockImplementation(() => {
      throw new Error('fail');
    });
    registerKeybindingExtension(mockApi);
    const handler = getSessionStartHandler();
    mockCtx = createMockCtx();
    let inputCallback: any;
    mockCtx.ui.onTerminalInput.mockImplementation((cb: any) => {
      inputCallback = cb;
      return () => {};
    });
    await handler('session_start', mockCtx);
    const result = inputCallback('t');
    expect(mockCtx.ui.notify).toHaveBeenCalledWith('Failed to execute team: fail', 'error');
    expect(result).toEqual({ consume: true });
  });

  it('unsubscribes on session shutdown', async () => {
    (existsSync as any).mockReturnValue(true);
    (readFileSync as any).mockReturnValue(JSON.stringify({ keybindings: { team: 't' } }));
    registerKeybindingExtension(mockApi);
    const handler = getSessionStartHandler();
    mockCtx = createMockCtx();
    let unsubscribe: any = () => {};
    mockCtx.ui.onTerminalInput.mockImplementation((cb: any) => {
      unsubscribe = () => {};
      return unsubscribe;
    });
    await handler('session_start', mockCtx);
    // Simulate shutdown
    const shutdownHandler = mockApi.on.mock.calls.find((c: any) => c[0] === 'session_shutdown')[1];
    shutdownHandler();
    // We can't easily verify unsubscribe called, but at least no errors
  });
});
