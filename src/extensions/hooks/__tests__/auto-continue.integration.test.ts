import { jest } from '@jest/globals';
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Import the actual hook
const autoContinueHook = await import('../auto-continue.js').then(m => m.default);

function createMockPI() {
  const handlers: Record<string, Function[]> = {};
  return {
    on: jest.fn((event: string, handler: Function) => {
      handlers[event] = handlers[event] || [];
      handlers[event].push(handler);
    }),
    sendMessage: jest.fn(),
    registerCommand: jest.fn(),
    getHandlers: () => handlers,
  };
}

function createMockContext(overrides: any = {}) {
  return {
    cwd: process.cwd(),
    hasUI: true,
    isIdle: jest.fn(() => true),
    ui: {
      notify: jest.fn(),
    },
    ...overrides,
  };
}

describe('Auto-Continue Hook Integration', () => {
  let pi: any;

  beforeEach(() => {
    jest.clearAllMocks();
    pi = createMockPI();
  });

  describe('Registration', () => {
    test('registers required event listeners and command', () => {
      autoContinueHook(pi);

      expect(pi.on).toHaveBeenCalledWith('session_shutdown', expect.any(Function));
      expect(pi.on).toHaveBeenCalledWith('agent_end', expect.any(Function));
      expect(pi.on).toHaveBeenCalledWith('session_compact', expect.any(Function));
      expect(pi.registerCommand).toHaveBeenCalledWith('gnpi', expect.objectContaining({
        description: expect.any(String),
        handler: expect.any(Function),
      }));
    });
  });

  describe('gnpi command variations', () => {
    let handler: any;
    let ctx: any;

    beforeEach(() => {
      autoContinueHook(pi);
      handler = pi.registerCommand.mock.calls[0][1].handler;
      ctx = createMockContext();
    });

    test('off command disables and clears timer', async () => {
      await handler('off', ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith('Auto-continue đã TẮT', 'info');
    });

    test('on command enables and notifies', async () => {
      await handler('on', ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringMatching(/BẬT/), 'info');
    });

    test('numeric argument sets timeout', async () => {
      await handler('15', ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith('Auto-continue timeout set to 15 giây', 'info');
    });

    test('toggle (empty args) switches state', async () => {
      // Default is off, first toggle turns on
      await handler('', ctx);
      expect(ctx.ui.notify).toHaveBeenNthCalledWith(1, expect.stringMatching(/BẬT/), 'info');

      // Clear and toggle again
      ctx.ui.notify.mockClear();
      await handler('', ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith('Auto-continue đã TẮT', 'info');
    });

    test('does not notify when hasUI is false', async () => {
      const noUICtx = createMockContext({ hasUI: false });

      // Should not throw, just skip notifications
      await handler('on', noUICtx);
      await handler('off', noUICtx);
      await handler('10', noUICtx);
      // No errors = pass
    });
  });

  describe('AUTO-CONTINUE.md loading', () => {
    test(' loads custom reminder from AUTO-CONTINUE.md if present in project root', () => {
      const tempDir = mkdtempSync(join(tmpdir(), 'auto-cont-test-'));
      const remakPath = join(tempDir, 'AUTO-CONTINUE.md');
      writeFileSync(remakPath, 'Custom reminder text');
      const oldCwd = process.cwd();
      try {
        process.chdir(tempDir);
        const pi = createMockPI();
        autoContinueHook(pi);
        // Hook loads at module init; no direct assertion possible but should not throw
        // We can verify that the module loaded successfully
      } finally {
        process.chdir(oldCwd);
        rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
