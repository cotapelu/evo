/* eslint @typescript-eslint/no-explicit-any: "off" */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {ExtensionContext} from '@earendil-works/pi-coding-agent';
import { existsSync, readFileSync } from 'node:fs';

// Mock external dependencies
vi.mock('@earendil-works/pi-coding-agent', () => ({ type: {} }));

// Mock fs for loadReminderMessage tests
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('../../utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  })),
}));

describe('loadReminderMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(process, 'cwd').mockReturnValue('/tmp/test-project');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should return DEFAULT_IDLE_MESSAGE when reminder file does not exist', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.resetModules();
    const { loadReminderMessage: lrm, DEFAULT_IDLE_MESSAGE } = await import('./auto-continue.js');
    const msg = lrm();
    expect(msg).toBe(DEFAULT_IDLE_MESSAGE);
  });

  it('should return trimmed content when reminder file exists and non-empty', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('  Custom reminder  \n');
    vi.resetModules();
    const { loadReminderMessage: lrm } = await import('./auto-continue.js');
    const msg = lrm();
    expect(msg).toBe('Custom reminder');
    expect(readFileSync).toHaveBeenCalled();
  });

  it('should return DEFAULT_IDLE_MESSAGE when file exists but empty after trim', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('   \n  ');
    vi.resetModules();
    const { loadReminderMessage: lrm, DEFAULT_IDLE_MESSAGE } = await import('./auto-continue.js');
    const msg = lrm();
    expect(msg).toBe(DEFAULT_IDLE_MESSAGE);
  });

  it('should return DEFAULT_IDLE_MESSAGE when readFileSync throws', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockImplementation(() => { throw new Error('read error'); });
    vi.resetModules();
    const { loadReminderMessage: lrm, DEFAULT_IDLE_MESSAGE } = await import('./auto-continue.js');
    const msg = lrm();
    expect(msg).toBe(DEFAULT_IDLE_MESSAGE);
  });
});

describe('auto-continue hook', () => {
  let mockPi: any;
  let mockCtx: ExtensionContext;
  let mod: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Reset modules to ensure fresh import with clean closures
    vi.resetModules();
    // Spy on process.cwd
    vi.spyOn(process, 'cwd').mockReturnValue('/tmp/test-project');

    // Prepare mock context
    mockCtx = {
      hasUI: true,
      ui: { notify: vi.fn() },
      isIdle: vi.fn().mockReturnValue(false),
    } as any;

    // Import module after mocks are ready
    mod = await import('./auto-continue.js');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function registerExtension() {
    mockPi = {
      on: vi.fn(),
      registerCommand: vi.fn(),
      sendMessage: vi.fn(),
    };
    mod.default(mockPi);
  }

  function getHandler() {
    return mockPi.registerCommand.mock.calls[0][1].handler as (args: string, ctx: ExtensionContext) => Promise<void>;
  }

  it('should register session_shutdown, agent_end, and session_compact listeners', () => {
    registerExtension();
    const eventNames = mockPi.on.mock.calls.map((c: any[]) => c[0]);
    expect(eventNames).toContain('session_shutdown');
    expect(eventNames).toContain('agent_end');
    expect(eventNames).toContain('session_compact');
  });

  it('should register gnpi command', () => {
    registerExtension();
    expect(mockPi.registerCommand).toHaveBeenCalledWith(
      'gnpi',
      expect.objectContaining({
        description: expect.any(String),
        handler: expect.any(Function),
      })
    );
  });

  it('handler: off command disables and notifies', async () => {
    registerExtension();
    const handler = getHandler();
    await handler('off', mockCtx);
    expect(mockCtx.ui.notify).toHaveBeenCalledWith('Auto-continue đã TẮT', 'info');
  });

  it('handler: on command enables and notifies', async () => {
    registerExtension();
    const handler = getHandler();
    await handler('on', mockCtx);
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(expect.stringMatching(/BẬT.*30/), 'info');
  });

  it('handler: numeric timeout sets and notifies', async () => {
    registerExtension();
    const handler = getHandler();
    await handler('60', mockCtx);
    expect(mockCtx.ui.notify).toHaveBeenCalledWith('Auto-continue timeout set to 60 giây', 'info');
  });

  it('handler: toggles when unrecognized command', async () => {
    registerExtension();
    const handler = getHandler();
    // first toggle -> on
    await handler('', mockCtx);
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('BẬT'), 'info');
    // second toggle -> off
    await handler('', mockCtx);
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('TẮT'), 'info');
  });

  it('agent_end triggers sendMessage after timer fires', async () => {
    registerExtension();
    const handler = getHandler();
    // Enable auto-continue
    await handler('on', mockCtx);
    // Get the agent_end callback
    const agentEndCb = mockPi.on.mock.calls.find((c: any[]) => c[0] === 'agent_end')?.[1];
    if (agentEndCb) {
      await agentEndCb(); // this schedules setTimeout
    }
    // Advance timers to trigger the scheduled timeout
    await vi.runAllTimersAsync();
    expect(mockPi.sendMessage).toHaveBeenCalledWith(
      { customType: 'auto-continue', content: expect.any(String), display: false },
      { triggerTurn: true, deliverAs: 'followUp' }
    );
  });

  it('handler: on when idle starts timer immediately', async () => {
    registerExtension();
    mockCtx.isIdle.mockReturnValue(true);
    const handler = getHandler();
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    await handler('on', mockCtx);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
    setTimeoutSpy.mockRestore();
  });

  it('handler: off clears active timer', async () => {
    registerExtension();
    const handler = getHandler();
    // Enable (idle false, no timer)
    await handler('on', mockCtx);
    // Spy on setTimeout before scheduling
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    // Trigger agent_end to schedule timer
    const agentEndCb = mockPi.on.mock.calls.find((c: any[]) => c[0] === 'agent_end')?.[1];
    if (agentEndCb) {
      await agentEndCb();
    }
    // Verify timer scheduled
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    setTimeoutSpy.mockRestore();
    // Now off
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    await handler('off', mockCtx);
    expect(clearTimeout).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('session_compact triggers sendMessage after timer fires', async () => {
    registerExtension();
    const handler = getHandler();
    await handler('on', mockCtx);
    const sessionCompactCb = mockPi.on.mock.calls.find((c: any[]) => c[0] === 'session_compact')?.[1];
    if (sessionCompactCb) {
      await sessionCompactCb(); // schedules timer
    }
    await vi.runAllTimersAsync();
    expect(mockPi.sendMessage).toHaveBeenCalledWith(
      { customType: 'auto-continue', content: expect.any(String), display: false },
      { triggerTurn: true, deliverAs: 'followUp' }
    );
  });

  // Additional branch coverage tests
  it('off: does not clear timer if idleTimer is null', async () => {
    registerExtension();
    const handler = getHandler();
    // Ensure no timer set; just call off
    const clearSpy = vi.spyOn(global, 'clearTimeout');
    await handler('off', mockCtx);
    expect(clearSpy).not.toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('off: does not notify if hasUI false', async () => {
    registerExtension();
    const handler = getHandler();
    mockCtx.hasUI = false;
    await handler('off', mockCtx);
    expect(mockCtx.ui.notify).not.toHaveBeenCalled();
  });

  it('on: does not notify if hasUI false', async () => {
    registerExtension();
    const handler = getHandler();
    mockCtx.hasUI = false;
    await handler('on', mockCtx);
    expect(mockCtx.ui.notify).not.toHaveBeenCalled();
  });

  it('on: does not start timer if isIdle false', async () => {
    registerExtension();
    const handler = getHandler();
    mockCtx.isIdle.mockReturnValue(false);
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    await handler('on', mockCtx);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });

  it('timeout: does not notify if hasUI false', async () => {
    registerExtension();
    const handler = getHandler();
    mockCtx.hasUI = false;
    await handler('45', mockCtx);
    expect(mockCtx.ui.notify).not.toHaveBeenCalled();
  });

  it('toggle: when enabled becomes false with no timer, does not clear', async () => {
    registerExtension();
    const handler = getHandler();
    // Start with enabled false (default), first toggle -> on
    await handler('', mockCtx);
    // Now enabled true, but no timer scheduled (isIdle false)
    const clearSpy = vi.spyOn(global, 'clearTimeout');
    // Second toggle -> off
    await handler('', mockCtx);
    expect(clearSpy).not.toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('toggle: when enabled becomes true with hasUI false, no notify', async () => {
    registerExtension();
    const handler = getHandler();
    mockCtx.hasUI = false;
    // Start with enabled false (default), toggle
    await handler('', mockCtx);
    expect(mockCtx.ui.notify).not.toHaveBeenCalled();
  });

  it('agent_end: does not sendMessage if not enabled', async () => {
    registerExtension();
    // Do not enable; default enabled = false
    const agentEndCb = mockPi.on.mock.calls.find((c: any[]) => c[0] === 'agent_end')?.[1];
    if (agentEndCb) {
      await agentEndCb();
    }
    expect(mockPi.sendMessage).not.toHaveBeenCalled();
  });

  it('session_compact: does not sendMessage if not enabled', async () => {
    registerExtension();
    // Not enabled
    const sessionCompactCb = mockPi.on.mock.calls.find((c: any[]) => c[0] === 'session_compact')?.[1];
    if (sessionCompactCb) {
      await sessionCompactCb();
    }
    expect(mockPi.sendMessage).not.toHaveBeenCalled();
  });

  it('on when already enabled does not schedule additional timer', async () => {
    registerExtension();
    const handler = getHandler();
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    const mockCtx = {
      hasUI: false,
      isIdle: vi.fn().mockReturnValue(true),
    };
    // First on: schedules timer
    await handler('on', mockCtx);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    // Second on: should not schedule another timer because idleTimer already set
    await handler('on', mockCtx);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    setTimeoutSpy.mockRestore();
  });

  it('handler: "0" command turns off auto-continue', async () => {
    registerExtension();
    const handler = getHandler();
    // Enable first
    await handler('on', mockCtx);
    // Then disable with '0'
    await handler('0', mockCtx);
    expect(mockCtx.ui.notify).toHaveBeenCalledWith('Auto-continue đã TẮT', 'info');
  });

  it('handler: "1" command turns on auto-continue', async () => {
    registerExtension();
    const handler = getHandler();
    await handler('1', mockCtx);
    expect(mockCtx.ui.notify).toHaveBeenCalledWith(expect.stringMatching(/BẬT.*30/), 'info');
  });

  it('session_shutdown clears timer when active', async () => {
    registerExtension();
    const handler = getHandler();
    const clearSpy = vi.spyOn(global, 'clearTimeout');
    // Enable and schedule timer via agent_end
    await handler('on', mockCtx);
    const agentEndCb = mockPi.on.mock.calls.find((c: any[]) => c[0] === 'agent_end')?.[1];
    if (agentEndCb) await agentEndCb();
    // Simulate session_shutdown
    const shutdownCb = mockPi.on.mock.calls.find((c: any[]) => c[0] === 'session_shutdown')?.[1];
    if (shutdownCb) await shutdownCb();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('session_shutdown does not clear when no timer', async () => {
    registerExtension();
    const clearSpy = vi.spyOn(global, 'clearTimeout');
    // Do not enable; no timer
    const shutdownCb = mockPi.on.mock.calls.find((c: any[]) => c[0] === 'session_shutdown')?.[1];
    if (shutdownCb) await shutdownCb();
    expect(clearSpy).not.toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('toggle off via empty command clears active timer via doToggle', async () => {
    registerExtension();
    const handler = getHandler();
    // Enable with on while idle, which starts timer
    mockCtx.isIdle.mockReturnValue(true);
    await handler('on', mockCtx);
    // Now toggle off using empty command (doToggle)
    const clearSpy = vi.spyOn(global, 'clearTimeout');
    await handler('', mockCtx);
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('on: starts timer when isIdle true', async () => {
    registerExtension();
    const handler = getHandler();
    mockCtx.hasUI = false;
    mockCtx.isIdle = vi.fn().mockReturnValue(true);
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    await handler('on', mockCtx);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    setTimeoutSpy.mockRestore();
  });

  it('findProjectRoot: returns startPath when no markers found', async () => {
    vi.resetModules();
    vi.spyOn(process, 'cwd').mockReturnValue('/no/markers/here');
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(false);
    const { findProjectRoot } = await import('./auto-continue.js');
    const result = findProjectRoot('/no/markers/here');
    expect(result).toBe('/no/markers/here');
  });
});
