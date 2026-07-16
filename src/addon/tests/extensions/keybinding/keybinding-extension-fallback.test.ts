import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock fs before keybinding-extension loads
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock getAgentDir to return '/' so dirname yields '/' and pop() is empty -> fallback to ".pi"
vi.mock('@earendil-works/pi-coding-agent', async () => {
  const actual = await vi.importActual('@earendil-works/pi-coding-agent');
  return {
    ...actual,
    getAgentDir: vi.fn(() => '/'), // root path
  };
});

import { existsSync, readFileSync } from 'fs';
import { registerKeybindingExtension } from '../../../extensions/keybinding/keybinding-extension.js';

describe('keybinding-extension fallback', () => {
  let mockApi: any;

  beforeEach(() => {
    vi.clearAllMocks();
    (existsSync as any).mockReturnValue(false); // no config file
    mockApi = { on: vi.fn() };
  });

  it('uses .pi fallback when AGENT_DIR yields empty CONFIG_DIR_NAME', async () => {
    registerKeybindingExtension(mockApi);
    // Find the session_start handler
    const call = mockApi.on.mock.calls.find((c: any) => c[0] === 'session_start');
    expect(call).toBeDefined();
    const handler = call[1];
    // Create a context with UI to ensure the handler runs fully
    const ctx = { hasUI: false, ui: {}, isIdle: () => true } as any;
    await handler('session_start', ctx);
    // Verify that existsSync was called with a config path that contains "/.pi/config.json"
    const firstCallPath = (existsSync as any).mock.calls[0][0];
    expect(firstCallPath).toMatch(/\/\.pi\/config\.json$/);
  });
});
