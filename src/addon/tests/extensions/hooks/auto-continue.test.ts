import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger before importing module
vi.mock('../../../extensions/utils/logger.js', () => ({
  createLogger: () => ({
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import { existsSync, readFileSync } from 'node:fs';

describe('AutoContinue Hook', () => {
  let autoContinue: any;
  let pi: any;
  let ctx: any;

  const DEFAULT_TIMEOUT = 30000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function loadModule(customExists?: boolean, customContent?: string) {
    (existsSync as any).mockReturnValue(customExists ?? false);
    if (customExists && customContent !== undefined) {
      (readFileSync as any).mockReturnValue(customContent);
    }
    autoContinue = await import('../../../extensions/hooks/auto-continue.js');
    pi = {
      on: vi.fn(),
      registerCommand: vi.fn(),
      sendMessage: vi.fn(),
    };
    ctx = {
      hasUI: true,
      isIdle: vi.fn().mockReturnValue(true),
      ui: { notify: vi.fn() },
    };
  }

  function getCommandHandler() {
    // pi.registerCommand called with 'gnpi' and object; handler is second argument
    return pi.registerCommand.mock.calls.find((c: any) => c[0] === 'gnpi')[1].handler;
  }

  function getEventHandler(eventName: string) {
    const entry = pi.on.mock.calls.find((c: any) => c[0] === eventName);
    return entry ? entry[1] : undefined;
  }

  it('uses default idle message when reminder file missing', async () => {
    await loadModule(false);
    autoContinue.default(pi);
    const handler = getCommandHandler();
    await handler('on', ctx);
    // Fast-forward past default timeout
    vi.advanceTimersByTime(DEFAULT_TIMEOUT + 1);
    expect(pi.sendMessage).toHaveBeenCalledWith(
      { customType: "auto-continue", content: expect.stringContaining("Continue next task"), display: false },
      { triggerTurn: true, deliverAs: "followUp" }
    );
  });

  it('uses custom message from file', async () => {
    await loadModule(true, "Custom reminder text");
    autoContinue.default(pi);
    const handler = getCommandHandler();
    await handler('on', ctx);
    vi.advanceTimersByTime(DEFAULT_TIMEOUT + 1);
    expect(pi.sendMessage).toHaveBeenCalledWith(
      { customType: "auto-continue", content: "Custom reminder text", display: false },
      { triggerTurn: true, deliverAs: "followUp" }
    );
  });

  describe('gnpi command', () => {
    beforeEach(async () => {
      await loadModule(false);
      autoContinue.default(pi);
    });

    it('turns off and notifies', async () => {
      const handler = getCommandHandler();
      // Turn on first
      await handler('on', ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringMatching(/BẬT/), 'info');
      // Turn off
      ctx.ui.notify = vi.fn();
      await handler('off', ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith("Auto-continue đã TẮT", 'info');
    });

    it('sets custom timeout', async () => {
      const handler = getCommandHandler();
      await handler('60', ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringMatching(/60 giây/), 'info');
      // Enable to start timer with custom timeout
      ctx.ui.notify = vi.fn();
      await handler('on', ctx);
      // Fast-forward 60s
      vi.advanceTimersByTime(60000 + 1);
      expect(pi.sendMessage).toHaveBeenCalled();
    });

    it('toggles when called without args', async () => {
      const handler = getCommandHandler();
      // Initially false
      await handler('', ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringMatching(/BẬT/), 'info');
      ctx.ui.notify = vi.fn();
      await handler('', ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith("Auto-continue đã TẮT", 'info');
    });
  });

  describe('event handlers', () => {
    beforeEach(async () => {
      await loadModule(false);
      autoContinue.default(pi);
    });

    it('session_shutdown stops timer if enabled', async () => {
      const handler = getCommandHandler();
      await handler('on', ctx); // enable and start timer
      // Fast-forward partially to not trigger message yet
      vi.advanceTimersByTime(DEFAULT_TIMEOUT / 2);
      // Simulate session shutdown
      const shutdownHandler = getEventHandler('session_shutdown');
      shutdownHandler();
      // Advance rest of time; should not trigger
      vi.advanceTimersByTime(DEFAULT_TIMEOUT / 2 + 1000);
      expect(pi.sendMessage).not.toHaveBeenCalled();
    });

    it('agent_end starts timer if enabled', async () => {
      const handler = getCommandHandler();
      await handler('on', ctx);
      // Agent end event should have been registered; call it
      const agentEndHandler = getEventHandler('agent_end');
      agentEndHandler();
      // Fast-forward to trigger
      vi.advanceTimersByTime(DEFAULT_TIMEOUT + 1);
      expect(pi.sendMessage).toHaveBeenCalled();
    });

    it('session_compact starts timer if enabled', async () => {
      const handler = getCommandHandler();
      await handler('on', ctx);
      const sessionCompactHandler = getEventHandler('session_compact');
      sessionCompactHandler();
      vi.advanceTimersByTime(DEFAULT_TIMEOUT + 1);
      expect(pi.sendMessage).toHaveBeenCalled();
    });
  });

  describe('startIdleTimer logic', () => {
    beforeEach(async () => {
      await loadModule(false);
      autoContinue.default(pi);
    });

    it('does not start timer if disabled', () => {
      // No call to on yet
      const handler = getCommandHandler();
      // Disabled by default; just ensure no timers via advance does nothing
      vi.advanceTimersByTime(DEFAULT_TIMEOUT + 1);
      expect(pi.sendMessage).not.toHaveBeenCalled();
    });

    it('does not start another timer if already active', async () => {
      const handler = getCommandHandler();
      await handler('on', ctx); // starts timer
      // Immediately call on again
      await handler('on', ctx);
      // Advance to full timeout; only one message should be sent
      vi.advanceTimersByTime(DEFAULT_TIMEOUT + 1);
      expect(pi.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('clears timer on shutdown', async () => {
      const handler = getCommandHandler();
      await handler('on', ctx);
      const shutdownHandler = getEventHandler('session_shutdown');
      shutdownHandler();
      // Advance to original timeout; should not fire
      vi.advanceTimersByTime(DEFAULT_TIMEOUT + 1);
      expect(pi.sendMessage).not.toHaveBeenCalled();
    });
  });
});
