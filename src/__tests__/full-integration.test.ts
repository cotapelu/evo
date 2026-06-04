// @ts-nocheck
import { jest } from '@jest/globals';
import {
  createAndRunRuntime,
  validateRuntimeOptions,
} from '../runtime/runtime-provider.js';
import {
  InteractiveModeProvider,
} from '../interactive/interactive-provider.js';

describe('Full Integration: runtime-provider → interactive-provider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset global runtime
    try {
      const { clearGlobalRuntime } = require('../runtime/runtime-runner.js');
      clearGlobalRuntime();
    } catch {
      // ignore if not available
    }
  });

  describe('Runtime creation', () => {
    it('should create runtime with default options', async () => {
      const { runtime, services, sessionResult, diagnostics, metrics } = await createAndRunRuntime();

      expect(runtime).toBeDefined();
      expect(runtime.session).toBeDefined();
      expect(services).toBeDefined();
      expect(services.settingsManager).toBeDefined();
      expect(services.modelRegistry).toBeDefined();
      expect(services.resourceLoader).toBeDefined();
      expect(sessionResult.session).toBeDefined();
      expect(diagnostics).toBeInstanceOf(Array);
      expect(metrics.totalMs).toBeGreaterThan(0);
      expect(metrics.servicesMs).toBeGreaterThan(0);
      expect(metrics.sessionMs).toBeGreaterThan(0);
    });

    it('should create runtime with custom options', async () => {
      const options = {
        tools: ['read', 'bash', 'grep'],
        thinkingLevel: 'high' as const,
        noExtensions: true,
        noSkills: true,
        noPromptTemplates: true,
        noThemes: true,
        noContextFiles: true,
        enableEventBus: false,
      };

      const { runtime, services, diagnostics } = await createAndRunRuntime(options);

      expect(runtime).toBeDefined();
      expect(runtime.session).toBeDefined();
      expect(services).toBeDefined();
      expect(diagnostics).toBeInstanceOf(Array);
    });

    it('should validate options before creation', async () => {
      const errors = validateRuntimeOptions({
        tools: ['read'],
        noTools: 'all', // conflict
      });
      expect(errors).toContain('Cannot specify both tools and noTools');
    });

    it('should reject invalid cwd', async () => {
      // Mock process.cwd to return non-existent path
      const originalCwd = process.cwd();
      let originalProcessCwd: () => string;
      try {
        // @ts-ignore - mocking internal
        originalProcessCwd = process.cwd;
        // @ts-ignore
        process.cwd = () => '/nonexistent-path-12345';
        await expect(createAndRunRuntime()).rejects.toThrow();
        // Restore
        // @ts-ignore
        process.cwd = originalProcessCwd;
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('InteractiveModeProvider integration', () => {
    it('should create provider and check status', async () => {
      const { runtime } = await createAndRunRuntime({
        tools: ['read'],
      });

      const provider = new InteractiveModeProvider(runtime);

      expect(provider).toBeInstanceOf(InteractiveModeProvider);
      expect(provider.getRuntime()).toBe(runtime);
      expect(provider.getInteractiveMode()).toBeNull();
      expect(provider.getStatus().mode).toBe('uninitialized');
      expect(provider.getStatus().isRunning).toBe(false);
      expect(provider.getStatus().sessionId).toBe(runtime.session.sessionId);
      expect(provider.getStatus().sessionFile).toBe(runtime.session.sessionFile);
    });

    it('should create InteractiveMode instance', async () => {
      const { runtime } = await createAndRunRuntime();

      const provider = new InteractiveModeProvider(runtime);
      const mode = provider.createInteractiveMode({
        verbose: true,
      });

      expect(mode).toBeDefined();
      expect(provider.getInteractiveMode()).not.toBeNull();
      expect(provider.getStatus().mode).toBe('interactive');
    });

    it('should handle error callbacks', async () => {
      const { runtime } = await createAndRunRuntime();

      const onError = jest.fn();
      const provider = new InteractiveModeProvider(runtime, {
        eventCallbacks: { onError },
      });

      // Trigger error handling (private method)
      provider['handleError'](new Error('Test error'));

      expect(onError).toHaveBeenCalled();
      expect(provider.getStatus().lastError).toBeInstanceOf(Error);
    });

    it('should track uptime', async () => {
      const { runtime } = await createAndRunRuntime();
      const provider = new InteractiveModeProvider(runtime);

      const startUptime = provider.getStatus().uptimeMs;
      await new Promise(resolve => setTimeout(resolve, 30));

      const laterUptime = provider.getStatus().uptimeMs;
      expect(laterUptime).toBeGreaterThan(startUptime);
    });
  });

  describe('End-to-end workflow', () => {
    it('should go from runtime creation to provider shutdown', async () => {
      // 1. Create runtime
      const { runtime } = await createAndRunRuntime({
        tools: ['read', 'bash'],
        thinkingLevel: 'medium',
      });

      // 2. Create provider
      const provider = new InteractiveModeProvider(runtime, {
        autoRetry: 1,
        fallbackToPrintMode: true,
      });

      // 3. Verify initial state
      expect(provider.getStatus().mode).toBe('uninitialized');
      expect(provider.getStatus().isRunning).toBe(false);

      // 4. Mock InteractiveMode.run to avoid blocking TUI
      const mockRun = jest.fn().mockResolvedValue(undefined);
      const mockStop = jest.fn().mockResolvedValue(undefined);
      // @ts-ignore - accessing private property to inject mock
      provider['interactiveModeInstance'] = { run: mockRun, stop: mockStop } as any;

      // 5. Run provider
      await provider.run({ verbose: true });

      // Verify mock was called
      expect(mockRun).toHaveBeenCalled();

      // 6. Check final state (provider should not be running after run completes)
      const status = provider.getStatus();
      expect(status.sessionId).toBe(runtime.session.sessionId);
      expect(status.sessionFile).toBe(runtime.session.sessionFile);
      expect(status.isRunning).toBe(false);

      // 7. Stop gracefully
      await provider.stop();
      expect(provider.getStatus().mode).toBe('shutdown');
      expect(provider.getStatus().isRunning).toBe(false);
    });
  });

  describe('Minimal runtime', () => {
    it('should create minimal runtime for testing', async () => {
      const { createMinimalRuntime } = await import('../runtime/runtime-provider.js');

      const minimal = await createMinimalRuntime({
        cwd: process.cwd(),
        tools: ['read'],
        thinkingLevel: 'low',
      });

      expect(minimal).toBeDefined();
      expect(minimal.session).toBeDefined();
      expect(minimal.session.sessionFile).toBeDefined();
    });
  });

  describe('Diagnostics aggregation', () => {
    it('should include extension errors in diagnostics', async () => {
      // This tests that if resourceLoader returns errors, they're included
      // We can't easily simulate extension errors, but we verify the structure
      const { diagnostics } = await createAndRunRuntime();

      // All diagnostics should have type and message
      for (const d of diagnostics) {
        expect(['info', 'warning', 'error']).toContain(d.type);
        expect(typeof d.message).toBe('string');
        expect(d.message.length).toBeGreaterThan(0);
      }
    });
  });
});
