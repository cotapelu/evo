import { describe, it, expect, vi, beforeEach } from 'vitest';
import diff from '../../../../../extensions/capability-system/plugins/git/capabilities/diff.ts';

function mockCwdCtx(cwd?: string, stdout?: string, stderr?: string, code?: number) {
  return {
    cwd: cwd,
    exec: vi.fn(async () => ({ stdout: stdout || '', stderr: stderr || '', code: code ?? 0, killed: false })),
  };
}

describe('git.diff branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to process.cwd when ctx.cwd is undefined', async () => {
    const originalCwd = process.cwd;
    process.cwd = () => '/default-cwd';
    try {
      const ctx = mockCwdCtx(undefined, 'diff output', '', 0);
      const result = await diff.execute({}, ctx);
      expect(result.isError).toBe(false);
      expect(ctx.exec).toHaveBeenCalledWith('git', ['diff', 'HEAD', '--color=never'], { cwd: '/default-cwd' });
    } finally {
      process.cwd = originalCwd;
    }
  });
});
