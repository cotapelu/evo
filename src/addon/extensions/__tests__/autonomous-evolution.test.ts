import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AutonomousEngine from '../autonomous-evolution';

// Helper to create mock ExecResult
const mockExecResult = (overlay: Partial<{ code: number; stdout: string; stderr: string; killed: boolean }>) => ({
  code: 0,
  stdout: '',
  stderr: '',
  killed: false,
  ...overlay,
});

describe('AutonomousEngine', () => {
  let mockApi: any;
  let engine: AutonomousEngine;
  let execMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    execMock = vi.fn();
    mockApi = {
      exec: execMock,
      sendUserMessage: vi.fn(),
      on: vi.fn(), // event registration
    };
    engine = new AutonomousEngine(mockApi, 2 * 60 * 60 * 1000);

    // Mock internal methods to avoid real fs/git
    vi.spyOn(engine, 'readCoverageSummary').mockResolvedValue({
      statements: 90,
      branches: 80,
      functions: 85,
      lines: 92,
    });
    vi.spyOn(engine, 'getCurrentCommit').mockResolvedValue('abc123commit');
    vi.spyOn(engine, 'scheduleNext').mockImplementation(() => {}); // avoid timer
    vi.spyOn(engine, 'logMetrics').mockImplementation(() => Promise.resolve());
    vi.spyOn(console, 'log').mockImplementation(() => {}); // silence
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('start/stop', () => {
    it('should set a timer when start() called', () => {
      const setTimerSpy = vi.spyOn(global, 'setTimeout');
      engine.start();
      expect(setTimerSpy).toHaveBeenCalled();
    });

    it('should clear timer when stop() called', () => {
      const clearTimerSpy = vi.spyOn(global, 'clearTimeout');
      engine.start();
      engine.stop();
      expect(clearTimerSpy).toHaveBeenCalled();
    });
  });

  describe('runDiagnostics', () => {
    it('should run lint, typecheck, test and return results', async () => {
      execMock
        .mockReturnValueOnce(mockExecResult({ code: 0, stdout: 'lint ok' }))
        .mockReturnValueOnce(mockExecResult({ code: 0, stdout: 'typecheck ok' }))
        .mockReturnValueOnce(
          mockExecResult({ code: 0, stdout: '{"tests":[{"name":"test1","status":"passed"}]' }),
        );

      const result = await (engine as any).runDiagnostics();

      expect(result.lint.code).toBe(0);
      expect(result.typecheck.code).toBe(0);
      expect(result.test.code).toBe(0);
      expect(result.testReporterJson).toEqual({ tests: [{ name: 'test1', status: 'passed' }] });
    });

    it('should parse test reporter JSON', async () => {
      execMock
        .mockReturnValueOnce(mockExecResult({ code: 0 }))
        .mockReturnValueOnce(mockExecResult({ code: 0 }))
        .mockReturnValueOnce(mockExecResult({ code: 0, stdout: '{"tests": [{"name":"A"}]}' }));

      const result = await (engine as any).runDiagnostics();
      expect(result.testReporterJson.tests).toHaveLength(1);
    });
  });

  describe('buildPrompt', () => {
    it('should include lint exit code and truncated output', () => {
      const longOutput = 'a'.repeat(5000);
      const diagnostics = {
        lint: { code: 1, stdout: longOutput, stderr: '' },
        typecheck: { code: 0, stdout: '', stderr: '' },
        test: { code: 0, stdout: '', stderr: '' },
      };
      const prompt = (engine as any).buildPrompt(diagnostics);
      expect(prompt).toContain('## Lint (exit code 1)');
      expect(prompt).toContain('... (truncated)');
    });

    it('should include instructions to follow GOAL.md workflow', () => {
      const diagnostics = {
        lint: { code: 0, stdout: '', stderr: '' },
        typecheck: { code: 0, stdout: '', stderr: '' },
        test: { code: 0, stdout: '', stderr: '' },
      };
      const prompt = (engine as any).buildPrompt(diagnostics);
      expect(prompt).toContain('GOAL.md workflow');
      expect(prompt).toContain('commit changes with a clear conventional commit message');
    });
  });

  describe('getPriority', () => {
    it('should return HIGH when tests failing', () => {
      const diag = { lint: { code: 0 }, typecheck: { code: 0 }, test: { code: 1 } };
      expect((engine as any).getPriority(diag)).toBe('HIGH');
    });

    it('should return MEDIUM when lint/typecheck failing', () => {
      const diag = { lint: { code: 1 }, typecheck: { code: 0 }, test: { code: 0 } };
      expect((engine as any).getPriority(diag)).toBe('MEDIUM');
    });

    it('should return LOW when no failures', () => {
      const diag = { lint: { code: 0 }, typecheck: { code: 0 }, test: { code: 0 } };
      expect((engine as any).getPriority(diag)).toBe('LOW');
    });
  });

  describe('readCoverageSummary', () => {
    it('should parse coverage-summary.json correctly', async () => {
      const fakeJson = {
        total: {
          statements: { pct: 95.5 },
          branches: { pct: 88.2 },
          functions: { pct: 90.0 },
          lines: { pct: 96.1 },
        },
      };
      const fsReadSpy = vi.spyOn(require('fs').promises, 'readFile').mockResolvedValue(JSON.stringify(fakeJson));
      const result = await (engine as any).readCoverageSummary();
      expect(result).toEqual({
        statements: 95.5,
        branches: 88.2,
        functions: 90.0,
        lines: 96.1,
      });
      fsReadSpy.mockRestore();
    });

    it('should return null if file missing', async () => {
      const fsReadSpy = vi.spyOn(require('fs').promises, 'readFile').mockRejectedValue(new Error('ENOENT'));
      const result = await (engine as any).readCoverageSummary();
      expect(result).toBeNull();
      fsReadSpy.mockRestore();
    });
  });

  describe('verifyChanges', () => {
    beforeEach(() => {
      // Set baseline before verification
      (engine as any).baselineTestCount = 100;
      (engine as any).baselineCoverage = { statements: 90, branches: 80, functions: 85, lines: 92 };
    });

    it('should fail if lint fails', async () => {
      execMock
        .mockReturnValueOnce(mockExecResult({ code: 1, stdout: '', stderr: 'lint err' })) // lint
        .mockReturnValueOnce(mockExecResult({ code: 0 })) // typecheck (not reached ideally, but we still call)
        .mockReturnValueOnce(mockExecResult({ code: 0, stdout: '{"tests":[{}]}' })); // test

      const result = await (engine as any).verifyChanges();
      expect(result.success).toBe(false);
      expect(result.notes).toContain('lint exit 1');
    });

    it('should fail if typecheck fails', async () => {
      execMock
        .mockReturnValueOnce(mockExecResult({ code: 0 }))
        .mockReturnValueOnce(mockExecResult({ code: 1, stderr: 'ts err' }))
        .mockReturnValueOnce(mockExecResult({ code: 0, stdout: '{"tests":[{}]}' }));

      const result = await (engine as any).verifyChanges();
      expect(result.success).toBe(false);
      expect(result.notes).toContain('typecheck exit 1');
    });

    it('should fail if tests fail', async () => {
      execMock
        .mockReturnValueOnce(mockExecResult({ code: 0 }))
        .mockReturnValueOnce(mockExecResult({ code: 0 }))
        .mockReturnValueOnce(mockExecResult({ code: 1, stdout: 'failures' }));

      const result = await (engine as any).verifyChanges();
      expect(result.success).toBe(false);
    });

    it('should compute deltas on success', async () => {
      execMock
        .mockReturnValueOnce(mockExecResult({ code: 0 }))
        .mockReturnValueOnce(mockExecResult({ code: 0 }))
        .mockReturnValueOnce(mockExecResult({ code: 0, stdout: '{"tests": [{}, {}]}' })); // 2 tests

      const result = await (engine as any).verifyChanges();
      expect(result.success).toBe(true);
      expect(result.testDelta).toBe(-98); // 2 - 100 = -98
      expect(result.totalTests).toBe(2);
      expect(result.coverageDelta).toEqual({
        statements: 90 - 90,
        branches: 80 - 80,
        functions: 85 - 85,
        lines: 92 - 92,
      });
    });
  });

  describe('ensureCommitted', () => {
    it('should return true if already committed', async () => {
      execMock
        .mockReturnValueOnce({ stdout: 'different', code: 0, stderr: '', killed: false }) // getCurrentCommit
        .mockReturnValueOnce({ stdout: 'different', code: 0, stderr: '', killed: false }); // getCurrentCommit second call? Actually ensureCommitted first calls getCurrentCommit, compares; if not equal, returns true. So only one call to getCurrentCommit needed.
      const result = await (engine as any).ensureCommitted();
      expect(result).toBe(true);
    });

    it('should commit if uncommitted changes present', async () => {
      // baselineCommit set
      (engine as any).baselineCommit = 'abc123';
      execMock
        .mockReturnValueOnce({ stdout: 'abc123', code: 0, stderr: '', killed: false }) // getCurrentCommit matches baseline
        .mockReturnValueOnce({ stdout: ' M file.ts', code: 0, stderr: '', killed: false }) // git status --porcelain (non-empty)
        .mockReturnValueOnce({ code: 0, stdout: '', stderr: '', killed: false }) // git add -A
        .mockReturnValueOnce({ code: 0, stdout: '', stderr: '', killed: false }); // git commit

      const result = await (engine as any).ensureCommitted();
      expect(result).toBe(true);
      expect(execMock).toHaveBeenNthCalledWith(3, 'git', ['add', '-A']);
      expect(execMock).toHaveBeenNthCalledWith(4, 'git', ['commit', '-m']);
    });

    it('should return false if no changes', async () => {
      (engine as any).baselineCommit = 'abc123';
      execMock
        .mockReturnValueOnce({ stdout: 'abc123', code: 0, stderr: '', killed: false })
        .mockReturnValueOnce({ stdout: '', code: 0, stderr: '', killed: false }); // git status empty

      const result = await (engine as any).ensureCommitted();
      expect(result).toBe(false);
    });
  });

  describe('logMetrics', () => {
    it('should append entry to AGENT_METRICS.md', async () => {
      const fsWriteSpy = vi.spyOn(require('fs').promises, 'writeFile');
      const fsReadSpy = vi.spyOn(require('fs').promises, 'readFile').mockResolvedValue('# Agent Metrics\n\n');

      await (engine as any).logMetrics({
        timestamp: '2025-01-01T00:00:00.000Z',
        type: 'Violation Fix',
        priority: 'HIGH',
        durationMs: 123456,
        status: 'Success',
        testDelta: 5,
        totalTests: 105,
        coverageDelta: { statements: 1.2, branches: 0.5, functions: 0.8, lines: 1.0 },
        notes: 'Fixed lint errors',
      });

      expect(fsWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('docs/AGENT_METRICS.md'),
        expect.stringContaining('Cycle 1'),
        'utf8',
      );
      fsReadSpy.mockRestore();
      fsWriteSpy.mockRestore();
    });
  });

  // Additional tests could cover rollback, full runCycle flow etc.
});
