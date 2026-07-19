import { describe, it, expect, vi, beforeEach } from 'vitest';
import commit from '../../../../../extensions/capability-system/plugins/git/capabilities/commit.ts';

function mockCwdCtx(cwd?: string, stdout?: string, stderr?: string, code?: number) {
  return {
    cwd: cwd,
    exec: vi.fn(async () => ({ stdout: stdout || '', stderr: stderr || '', code: code ?? 0, killed: false })),
  };
}

describe('git.commit branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to process.cwd when ctx.cwd is undefined', async () => {
    const originalCwd = process.cwd;
    process.cwd = () => '/default-cwd';
    try {
      const ctx = mockCwdCtx(undefined, 'Committed', '', 0);
      const result = await commit.execute({ message: 'Test' }, ctx);
      expect(result.isError).toBe(false);
      expect(ctx.exec).toHaveBeenCalledWith('git', ['commit', '-m', 'Test'], { cwd: '/default-cwd' });
    } finally {
      process.cwd = originalCwd;
    }
  });

  it('uses fallback message when stdout is empty', async () => {
    const ctx = mockCwdCtx('/test', '', '', 0);
    const result = await commit.execute({ message: 'Empty' }, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('✅ Committed');
  });
});
