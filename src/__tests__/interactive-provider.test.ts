// @ts-nocheck
import { jest } from '@jest/globals';
import { InteractiveModeProvider } from '../interactive/interactive-provider.js';

describe('Interactive Mode Provider (Unit)', () => {
  let mockRuntime: any;

  beforeEach(() => {
    mockRuntime = { session: null };
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const provider = new InteractiveModeProvider(mockRuntime);
      expect(provider).toBeInstanceOf(InteractiveModeProvider);
      expect(provider.getRuntime()).toBe(mockRuntime);
    });

    it('should accept custom options', () => {
      const options = { autoRetry: 5, retryDelayMs: 2000 };
      const provider = new InteractiveModeProvider(mockRuntime, options);
      expect(provider.options.autoRetry).toBe(5);
      expect(provider.options.retryDelayMs).toBe(2000);
    });

    it('should initialize status with correct defaults', () => {
      const provider = new InteractiveModeProvider(mockRuntime);
      const status = provider.getStatus();

      expect(status.mode).toBe('uninitialized');
      expect(status.isRunning).toBe(false);
      expect(status.sessionId).toBeUndefined();
      expect(status.sessionFile).toBeUndefined();
      expect(status.subscriptionsCount).toBe(0);
      expect(typeof status.startTime).toBe('number');
      expect(typeof status.uptimeMs).toBe('number');
      expect(status.lastError).toBeUndefined();
    });
  });

  describe('status updates', () => {
    it('should include session info when available', () => {
      mockRuntime.session = {
        sessionId: 'abc123',
        sessionFile: '/sessions/123.jsonl',
      };
      const provider = new InteractiveModeProvider(mockRuntime);
      const status = provider.getStatus();

      expect(status.sessionId).toBe('abc123');
      expect(status.sessionFile).toBe('/sessions/123.jsonl');
    });

    it('should update uptime', async () => {
      const provider = new InteractiveModeProvider(mockRuntime);
      const start = provider.getStatus().uptimeMs;

      await new Promise(r => setTimeout(r, 30));

      const later = provider.getStatus();
      expect(later.uptimeMs).toBeGreaterThan(start);
    });

    it('should keep startTime constant', async () => {
      const provider = new InteractiveModeProvider(mockRuntime);
      const startTime = provider.getStatus().startTime;

      await new Promise(r => setTimeout(r, 20));

      expect(provider.getStatus().startTime).toBe(startTime);
    });
  });

  describe('error handling', () => {
    it('should store Error objects', () => {
      const provider = new InteractiveModeProvider(mockRuntime);
      const err = new Error('Test error');

      provider['handleError'](err);

      expect(provider.getStatus().lastError).toBe(err);
    });

    it('should convert string to Error', () => {
      const provider = new InteractiveModeProvider(mockRuntime);
      provider['handleError']('oops');

      expect(provider.getStatus().lastError.message).toBe('oops');
    });

    it('should convert object to Error with toString', () => {
      const provider = new InteractiveModeProvider(mockRuntime);
      provider['handleError']({ x: 1 });

      expect(provider.getStatus().lastError.message).toBe('[object Object]');
    });

    it('should call event callback on error', () => {
      const onError = jest.fn();
      const provider = new InteractiveModeProvider(mockRuntime, {
        eventCallbacks: { onError },
      });

      provider['handleError'](new Error('test'));

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should set mode to shutdown', async () => {
      const provider = new InteractiveModeProvider(mockRuntime);

      await provider.stop();

      expect(provider.getStatus().mode).toBe('shutdown');
      expect(provider.getStatus().isRunning).toBe(false);
    });
  });

  describe('sleep helper', () => {
    it('should wait approximately the specified time', async () => {
      const provider = new InteractiveModeProvider(mockRuntime);
      const start = Date.now();

      await provider['sleep'](50);

      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });

  describe('getRuntime', () => {
    it('should return the provided runtime', () => {
      const provider = new InteractiveModeProvider(mockRuntime);
      expect(provider.getRuntime()).toBe(mockRuntime);
    });
  });

  describe('provider as instance', () => {
    it('should be instance of InteractiveModeProvider', () => {
      const provider = new InteractiveModeProvider(mockRuntime);
      expect(provider instanceof InteractiveModeProvider).toBe(true);
    });

    it('should have methods defined', () => {
      const provider = new InteractiveModeProvider(mockRuntime);
      expect(typeof provider.getStatus).toBe('function');
      expect(typeof provider.getRuntime).toBe('function');
      expect(typeof provider.createInteractiveMode).toBe('function');
      expect(typeof provider.getInteractiveMode).toBe('function');
      expect(typeof provider.stop).toBe('function');
      expect(typeof provider.showError).toBe('function');
      expect(typeof provider.showWarning).toBe('function');
      expect(typeof provider.shutdown).toBe('function');
    });
  });
});

describe('Module exports', () => {
  it('should export InteractiveModeProvider class', async () => {
    const mod = await import('../interactive/interactive-provider.js');
    expect(mod.InteractiveModeProvider).toBeDefined();
    expect(typeof mod.InteractiveModeProvider).toBe('function');
  });

  it('should export InteractiveMode', async () => {
    const mod = await import('../interactive/interactive-provider.js');
    expect(mod.InteractiveMode).toBeDefined();
  });
});
