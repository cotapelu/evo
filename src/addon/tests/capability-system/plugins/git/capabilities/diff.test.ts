import { describe, it, expect, vi, beforeEach } from 'vitest';
import diff from '../../../../../extensions/capability-system/plugins/git/capabilities/diff.ts';

function mockCtx(opts: { stdout?: string; stderr?: string; code?: number } = {}) {
  return {
    cwd: '/test',
    exec: vi.fn(async () => ({ stdout: opts.stdout || '', stderr: opts.stderr || '', code: opts.code ?? 0, killed: false })),
  };
}

describe('git.diff capability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return diff output', async () => {
    const ctx = mockCtx({ stdout: 'diff --git a/file.ts b/file.ts\n--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new', code: 0 });
    const result = await diff.execute({}, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('git', ['diff', 'HEAD', '--color=never'], { cwd: '/test' });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('diff --git');
    expect(result.details.revision).toBe('HEAD');
    expect(result.details.lines).toBeGreaterThan(1);
  });

  it('should use custom revision', async () => {
    const ctx = mockCtx({ stdout: 'diff output', code: 0 });
    const result = await diff.execute({ revision: 'v1.0' }, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('git', ['diff', 'v1.0', '--color=never'], { cwd: '/test' });
    expect(result.isError).toBe(false);
    expect(result.details.revision).toBe('v1.0');
  });

  it('should handle no changes', async () => {
    const ctx = mockCtx({ stdout: '', code: 0 });
    const result = await diff.execute({}, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('(no changes)');
    expect(result.details.lines).toBe(1); // one line? Actually output is single string; split lines count might be 1.
  });

  it('should return error when diff fails', async () => {
    const ctx = mockCtx({ stderr: 'fatal: ambiguous revision', code: 128 });
    const result = await diff.execute({ revision: 'nonexistent' }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('❌ git diff failed');
    expect(result.details.exitCode).toBe(128);
  });

  it('should handle exception', async () => {
    const ctx = mockCtx();
    (ctx.exec as any).mockRejectedValue(new Error('git not found'));
    const result = await diff.execute({}, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('❌ Error: git not found');
  });
});
