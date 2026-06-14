import { vi, describe, it, expect, beforeEach } from "vitest";
import type { Mock } from "vitest";

// Mock fs and os before importing keybinding-extension
vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => JSON.stringify({ keybindings: { team: 't', settings: 'ctrl+s' }})),
}));

vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/test'),
}));

import { registerKeybindingExtension } from "../extensions/keybinding/keybinding-extension.js";
import * as fs from 'fs'; // access to the mocked readFileSync
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

describe("Keybinding Extension", () => {
  let mockApi: any;
  let mockOn: any;
  let mockOnTerminalInput: Mock;
  let unsubscribe: Mock;
  let mockSendUserMessage: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset readFileSync to default configuration for each test
    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify({ keybindings: { team: 't', settings: 'ctrl+s' }}));
    mockOn = vi.fn();
    mockOnTerminalInput = vi.fn(() => unsubscribe);
    unsubscribe = vi.fn();
    mockSendUserMessage = vi.fn().mockResolvedValue(undefined);
    mockApi = {
      on: mockOn,
      sendUserMessage: mockSendUserMessage,
    };
  });

  it("registers session_start listener", () => {
    registerKeybindingExtension(mockApi);
    const sessionStartCalls = mockOn.mock.calls.filter((c: any) => c[0] === "session_start");
    expect(sessionStartCalls.length).toBeGreaterThan(0);
  });

  it("sets up keybindings from config and executes command via sendUserMessage", async () => {
    // Config already mocked to include both bindings via beforeEach
    registerKeybindingExtension(mockApi);
    const sessionStartCall = mockOn.mock.calls.find((c: any) => c[0] === "session_start");
    expect(sessionStartCall).toBeDefined();
    const handler = sessionStartCall![1];

    const mockOnTerminal = vi.fn().mockReturnValue(unsubscribe);
    const ctx = {
      isIdle: () => true,
      mode: "tui",
      hasUI: true,
      ui: { onTerminalInput: mockOnTerminal },
    } as unknown as ExtensionContext;

    await handler(null, ctx);
    expect(mockOnTerminal).toHaveBeenCalledTimes(1);
    const inputHandler = mockOnTerminal.mock.calls[0][0];

    // Simulate pressing 't'
    inputHandler("t");
    expect(mockSendUserMessage).toHaveBeenCalledWith("/team");

    // Simulate ctrl+s (ASCII 19)
    inputHandler(String.fromCharCode(19));
    expect(mockSendUserMessage).toHaveBeenCalledWith("/settings");
  });

  it("does not execute command when agent is not idle", async () => {
    // Override config to only have team binding
    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify({ keybindings: { team: "t" }}));

    registerKeybindingExtension(mockApi);
    const sessionStartCall = mockOn.mock.calls.find((c: any) => c[0] === "session_start");
    const handler = sessionStartCall![1];

    const mockOnTerminal = vi.fn().mockReturnValue(unsubscribe);
    const ctx = {
      isIdle: () => false,
      mode: "tui",
      hasUI: true,
      ui: { onTerminalInput: mockOnTerminal },
    } as unknown as ExtensionContext;

    await handler(null, ctx);
    const inputHandler = mockOnTerminal.mock.calls[0][0];

    inputHandler("t");
    expect(mockSendUserMessage).not.toHaveBeenCalled();
  });

  it("ignores keys with no binding", async () => {
    // Override config to only have team binding
    (fs.readFileSync as Mock).mockReturnValue(JSON.stringify({ keybindings: { team: "t" }}));

    registerKeybindingExtension(mockApi);
    const sessionStartCall = mockOn.mock.calls.find((c: any) => c[0] === "session_start");
    const handler = sessionStartCall![1];

    const mockOnTerminal = vi.fn().mockReturnValue(unsubscribe);
    const ctx = {
      isIdle: () => true,
      mode: "tui",
      ui: { onTerminalInput: mockOnTerminal },
    } as unknown as ExtensionContext;

    await handler(null, ctx);
    const inputHandler = mockOnTerminal.mock.calls[0][0];

    inputHandler("x");
    expect(mockSendUserMessage).not.toHaveBeenCalled();
  });
});
