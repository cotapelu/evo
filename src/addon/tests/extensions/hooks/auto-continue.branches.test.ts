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

describe('AutoContinue Branch Coverage', () => {
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

  async function loadModule(customExists?: boolean, customContent?: string, customReadImpl?: () => string) {
    (existsSync as any).mockReturnValue(customExists ?? false);
    if (customExists) {
      if (customReadImpl) {
        (readFileSync as any).mockImplementation(customReadImpl);
      } else if (customContent !== undefined) {
        (readFileSync as any).mockReturnValue(customContent);
      } else {
        (readFileSync as any).mockReturnValue('content');
      }
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
    return pi.registerCommand.mock.calls.find((c: any) => c[0] === 'gnpi')[1].handler;
  }

  function getEventHandler(eventName: string) {
    const entry = pi.on.mock.calls.find((c: any) => c[0] === eventName);
    return entry ? entry[1] : undefined;
  }

  it('falls back to default when reminder file exists but empty after trim', async () => {
    await loadModule(true, '   \n  ');
    autoContinue.default(pi);
    const handler = getCommandHandler();
    await handler('on', ctx);
    vi.advanceTimersByTime(DEFAULT_TIMEOUT + 1);
    expect(pi.sendMessage).toHaveBeenCalledWith(
      { customType: "auto-continue", content: expect.stringContaining("Continue next task"), display: false },
      { triggerTurn: true, deliverAs: "followUp" }
    );
  });

  it('falls back to default when readFileSync throws', async () => {
    const mockError = new Error('read fail');
    await loadModule(true, undefined, () => { throw mockError; });
    autoContinue.default(pi);
    const handler = getCommandHandler();
    await handler('on', ctx);
    vi.advanceTimersByTime(DEFAULT_TIMEOUT + 1);
    expect(pi.sendMessage).toHaveBeenCalledWith(
      { customType: "auto-continue", content: expect.stringContaining("Continue next task"), display: false },
      { triggerTurn: true, deliverAs: "followUp" }
    );
  });

  it('does not show UI notification when hasUI is false', async () => {
    await loadModule(false);
    ctx.hasUI = false;
    autoContinue.default(pi);
    const handler = getCommandHandler();
    await handler('on', ctx);
    expect(ctx.ui.notify).not.toHaveBeenCalled();
  });

  it('does not start timer immediately if not idle when enabling', async () => {
    await loadModule(false);
    ctx.isIdle.mockReturnValue(false);
    autoContinue.default(pi);
    const handler = getCommandHandler();
    await handler('on', ctx);
    // No timer should be started because isIdle returned false
    vi.advanceTimersByTime(DEFAULT_TIMEOUT + 1);
    expect(pi.sendMessage).not.toHaveBeenCalled();
  });

  it('agent_end does not start timer when disabled', async () => {
    await loadModule(false);
    autoContinue.default(pi);
    // enabled is false by default
    const agentEndHandler = getEventHandler('agent_end');
    expect(agentEndHandler).toBeDefined();
    agentEndHandler();
    // Should not start timer
    vi.advanceTimersByTime(DEFAULT_TIMEOUT + 1);
    expect(pi.sendMessage).not.toHaveBeenCalled();
  });

  it('session_compact does not start timer when disabled', async () => {
    await loadModule(false);
    autoContinue.default(pi);
    const sessionCompactHandler = getEventHandler('session_compact');
    expect(sessionCompactHandler).toBeDefined();
    sessionCompactHandler();
    vi.advanceTimersByTime(DEFAULT_TIMEOUT + 1);
    expect(pi.sendMessage).not.toHaveBeenCalled();
  });
});
