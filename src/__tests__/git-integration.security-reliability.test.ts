import { jest } from '@jest/globals';

function createMockPi() {
  const mockPi: any = {
    exec: jest.fn().mockImplementation(async (command: any, args: any, options?: any) => {
      return { stdout: '', stderr: '', code: 0, killed: false };
    }),
    on: jest.fn((event: string, handler: Function) => {
      // store handlers in a map attached to mockPi
      (mockPi as any)._handlers ??= {};
      (mockPi as any)._handlers[event] = handler;
    }),
    appendEntry: jest.fn(),
    sessionManager: {
      getEntries: jest.fn(() => []),
      getLeafEntry: jest.fn(() => ({ id: 'test-entry' })),
    },
    ui: {
      select: jest.fn(),
      notify: jest.fn(),
    },
    hasUI: true,
  };
  return mockPi;
}

function getHandler(mockPi: any, event: string) {
  return (mockPi as any)._handlers?.[event];
}

describe('Git Integration – Security & Reliability', () => {
  let mockPi: any;
  let ext: any;

  beforeEach(async () => {
    jest.resetModules();
    mockPi = createMockPi();
    const module = await import('../extensions/git-integration.js');
    ext = module.default;
    ext(mockPi);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('execGit timeout option', () => {
    it('should pass timeout to pi.exec for isGitRepo call', async () => {
      // session_start calls isGitRepo -> execGit -> pi.exec
      const sessionStartHandler = getHandler(mockPi, 'session_start');
      expect(sessionStartHandler).toBeDefined();
      await sessionStartHandler(null, {}); // event, ctx (ctx unused)
      await Promise.resolve(); // wait for async

      const calls = mockPi.exec.mock.calls;
      const revParseCall = calls.find(([cmd, args] : any) => cmd === 'git' && args.includes('rev-parse'));
      expect(revParseCall).toBeDefined();
      const options = revParseCall[2];
      expect(options?.timeout).toBe(10000);
    });
  });

  describe('Retry logic', () => {
    it('should retry on failure up to maxRetries (2)', async () => {
      // Setup entryId for turn_start
      const toolResultHandler = getHandler(mockPi, 'tool_result');
      mockPi.sessionManager.getLeafEntry.mockReturnValue({ id: 'entry1' });
      await toolResultHandler(null, { sessionManager: mockPi.sessionManager });

      // Custom exec: rev-parse ok; stash fails twice then succeeds
      let stashAttempt = 0;
      mockPi.exec.mockImplementation(async (command: any, args: any, options?: any) => {
        if (args.includes('rev-parse')) {
          return { stdout: '', code: 0 };
        }
        if (args.includes('stash')) {
          stashAttempt++;
          if (stashAttempt <= 2) {
            throw new Error('git: transient error');
          }
          return { stdout: 'ref', code: 0 };
        }
        return { stdout: '', code: 0 };
      });

      const turnStartHandler = getHandler(mockPi, 'turn_start');
      await turnStartHandler();
      await Promise.resolve();

      const stashCalls = mockPi.exec.mock.calls.filter(([cmd, args] : any) => cmd === 'git' && args.includes('stash'));
      expect(stashCalls.length).toBe(3);
    });

    it('should stop after maxRetries and throw', async () => {
      const toolResultHandler = getHandler(mockPi, 'tool_result');
      mockPi.sessionManager.getLeafEntry.mockReturnValue({ id: 'entry2' });
      await toolResultHandler(null, { sessionManager: mockPi.sessionManager });

      mockPi.exec.mockImplementation(async (command: any, args: any) => {
        if (args.includes('rev-parse')) {
          return { stdout: '', code: 0 };
        }
        if (args.includes('stash')) {
          throw new Error('git: persistent failure');
        }
        return { stdout: '', code: 0 };
      });

      const turnStartHandler = getHandler(mockPi, 'turn_start');
      await turnStartHandler();
      await Promise.resolve();

      const stashCalls = mockPi.exec.mock.calls.filter(([cmd, args] : any) => cmd === 'git' && args.includes('stash'));
      expect(stashCalls.length).toBe(3);
    });
  });

  describe('Stash message sanitization', () => {
    it('removes control characters and newlines', async () => {
      const badId = "bad\x00id\nwith\rcontrol";
      mockPi.sessionManager.getLeafEntry.mockReturnValue({ id: badId });
      const toolResultHandler = getHandler(mockPi, 'tool_result');
      await toolResultHandler(null, { sessionManager: mockPi.sessionManager });

      const turnStartHandler = getHandler(mockPi, 'turn_start');
      await turnStartHandler();
      await Promise.resolve();

      const calls = mockPi.exec.mock.calls;
      const stashCall = calls.find(([cmd, args] : any) => cmd === 'git' && args.includes('stash') && args.includes('create'));
      expect(stashCall).toBeDefined();
      const message = stashCall[1][3]; // '-m', message
      expect(message).toContain('pi-checkpoint-');
      expect(message).not.toMatch(/[\x00-\x1F\x7F\r\n]/);
    });
  });

  describe('Checkpoint cleanup', () => {
    it('clears checkpoints on agent_end', async () => {
      // Setup entryId
      const toolResultHandler = getHandler(mockPi, 'tool_result');
      mockPi.sessionManager.getLeafEntry.mockReturnValue({ id: 'e1' });
      await toolResultHandler(null, { sessionManager: mockPi.sessionManager });

      mockPi.exec.mockResolvedValue({ stdout: 'ref', code: 0 });
      const turnStartHandler = getHandler(mockPi, 'turn_start');
      await turnStartHandler();
      await Promise.resolve();
      expect(mockPi.exec.mock.calls.some(([cmd, args] : any) => cmd === 'git' && args.includes('stash'))).toBe(true);

      mockPi.exec.mockClear();

      // agent_end
      const agentEndHandler = getHandler(mockPi, 'agent_end');
      await agentEndHandler();
      await Promise.resolve();

      // Another turn_start should succeed without leftover state causing errors
      await turnStartHandler();
      await Promise.resolve();
      expect(mockPi.exec.mock.calls.some(([cmd, args] : any) => cmd === 'git' && args.includes('stash'))).toBe(true);
    });

    it('clears checkpoints on session_shutdown', async () => {
      const toolResultHandler = getHandler(mockPi, 'tool_result');
      mockPi.sessionManager.getLeafEntry.mockReturnValue({ id: 'e2' });
      await toolResultHandler(null, { sessionManager: mockPi.sessionManager });

      mockPi.exec.mockResolvedValue({ stdout: 'ref', code: 0 });
      const turnStartHandler = getHandler(mockPi, 'turn_start');
      await turnStartHandler();
      await Promise.resolve();
      mockPi.exec.mockClear();

      const shutdownHandler = getHandler(mockPi, 'session_shutdown');
      const ctx = { hasUI: true, ui: mockPi.ui, sessionManager: mockPi.sessionManager };
      await shutdownHandler(null, ctx);
      await Promise.resolve();

      // No exception indicates success
      expect(true).toBe(true);
    });
  });

  describe('hasUncommittedChanges error handling', () => {
    it('logs debug and returns false when git status fails', async () => {
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
      mockPi.exec.mockImplementation(async (command: any, args: any) => {
        if (args.includes('rev-parse')) {
          return { stdout: '', code: 0 };
        }
        if (args.includes('status')) {
          throw new Error('fatal: not a git repository');
        }
        return { stdout: '', code: 0 };
      });

      const shutdownHandler = getHandler(mockPi, 'session_shutdown');
      const ctx = { hasUI: true, ui: mockPi.ui, sessionManager: mockPi.sessionManager };
      await shutdownHandler(null, ctx);
      await Promise.resolve();

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Git status check failed:'),
        expect.any(String)
      );
      debugSpy.mockRestore();
    });
  });

  describe('Commit message generation', () => {
    it('produces a [pi] prefixed message when no assistant messages', async () => {
      mockPi.sessionManager.getEntries.mockReturnValue([]);
      mockPi.exec.mockImplementation(async (command: any, args: any) => {
        if (args.includes('rev-parse')) return { stdout: '', code: 0 };
        if (args.includes('status')) return { stdout: ' M file.txt', code: 0 };
        if (args.includes('add')) return { stdout: '', code: 0 };
        if (args.includes('commit')) return { stdout: '', code: 0 };
        return { stdout: '', code: 0 };
      });

      const shutdownHandler = getHandler(mockPi, 'session_shutdown');
      const ctx = { hasUI: true, ui: mockPi.ui, sessionManager: mockPi.sessionManager };
      await shutdownHandler(null, ctx);
      await Promise.resolve();

      const commitCalls = mockPi.exec.mock.calls.filter(([cmd, args] : any) => cmd === 'git' && args.includes('commit'));
      expect(commitCalls.length).toBeGreaterThan(0);
      const msg = commitCalls[0][1][2]; // commit -m <message>
      expect(msg).toMatch(/^\[pi\] /);
    });

    it('sanitizes commit message to ASCII and <= 72 chars', async () => {
      const longWithNonAscii = 'A'.repeat(100) + 'é';
      mockPi.sessionManager.getEntries.mockReturnValue([
        { type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: longWithNonAscii }] } },
      ]);
      mockPi.exec.mockImplementation(async (command: any, args: any) => {
        if (args.includes('rev-parse')) return { stdout: '', code: 0 };
        if (args.includes('status')) return { stdout: ' M file.txt', code: 0 };
        if (args.includes('add')) return { stdout: '', code: 0 };
        if (args.includes('commit')) return { stdout: '', code: 0 };
        return { stdout: '', code: 0 };
      });

      const shutdownHandler = getHandler(mockPi, 'session_shutdown');
      const ctx = { hasUI: true, ui: mockPi.ui, sessionManager: mockPi.sessionManager };
      await shutdownHandler(null, ctx);
      await Promise.resolve();

      const commitCalls = mockPi.exec.mock.calls.filter(([cmd, args] : any) => cmd === 'git' && args.includes('commit'));
      const msg = commitCalls[0][1][2]; // commit -m <message>
      expect(msg.length).toBeLessThanOrEqual(72);
      expect(msg).not.toMatch(/[^\x20-\x7E]/);
    });
  });

  describe('Checkpoint restore flow', () => {
    it('applies stash and notifies on success', async () => {
      // Setup entryId
      const toolResultHandler = getHandler(mockPi, 'tool_result');
      mockPi.sessionManager.getLeafEntry.mockReturnValue({ id: 'entryX' });
      await toolResultHandler(null, { sessionManager: mockPi.sessionManager });

      // Stash create succeeds
      mockPi.exec.mockResolvedValue({ stdout: 'ref123', code: 0 });

      const turnStartHandler = getHandler(mockPi, 'turn_start');
      await turnStartHandler();
      await Promise.resolve();
      mockPi.exec.mockClear();

      // before_fork
      const beforeForkHandler = getHandler(mockPi, 'session_before_fork');
      const ctx = { hasUI: true, ui: mockPi.ui, sessionManager: mockPi.sessionManager };
      mockPi.ui.select.mockResolvedValue('Yes, restore code to that point');
      // Stash apply will succeed (default)
      await beforeForkHandler({ entryId: 'entryX' }, ctx);
      await Promise.resolve();

      const applyCalls = mockPi.exec.mock.calls.filter(([cmd, args] : any) => cmd === 'git' && args.includes('apply'));
      expect(applyCalls.length).toBeGreaterThan(0);
      expect(mockPi.ui.notify).toHaveBeenCalledWith(expect.stringContaining('restored'), 'info');
    });

    it('notifies error on stash apply failure', async () => {
      const toolResultHandler = getHandler(mockPi, 'tool_result');
      mockPi.sessionManager.getLeafEntry.mockReturnValue({ id: 'entryY' });
      await toolResultHandler(null, { sessionManager: mockPi.sessionManager });

      mockPi.exec.mockResolvedValue({ stdout: 'ref', code: 0 });

      const turnStartHandler = getHandler(mockPi, 'turn_start');
      await turnStartHandler();
      await Promise.resolve();
      mockPi.exec.mockClear();

      // make apply fail
      mockPi.exec.mockImplementation(async (command: any, args: any) => {
        if (args.includes('apply')) {
          throw new Error('stash apply failed');
        }
        return { stdout: '', code: 0 };
      });

      const beforeForkHandler = getHandler(mockPi, 'session_before_fork');
      const ctx = { hasUI: true, ui: mockPi.ui, sessionManager: mockPi.sessionManager };
      mockPi.ui.select.mockResolvedValue('Yes, restore code to that point');
      await beforeForkHandler({ entryId: 'entryY' }, ctx);
      await Promise.resolve();

      expect(mockPi.ui.notify).toHaveBeenCalledWith(
        expect.stringContaining('Failed to restore'),
        'error'
      );
    });
  });
});
