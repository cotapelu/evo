import { describe, it, expect, vi, beforeEach } from 'vitest';
import commit from '../../../../../extensions/capability-system/plugins/git/capabilities/commit.ts';

function mockCtx(opts: { stdout?: string; stderr?: string; code?: number } = {}) {
  return {
    cwd: '/test',
    exec: vi.fn(async () => ({ stdout: opts.stdout || '', stderr: opts.stderr || '', code: opts.code ?? 0, killed: false })),
  };
}

describe('git.commit capability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should commit with message', async () => {
    const ctx = mockCtx({ stdout: 'Committed changes', code: 0 });
    const result = await commit.execute({ message: 'Fix bug' }, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('git', ['commit', '-m', 'Fix bug'], { cwd: '/test' });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('Committed changes');
    expect(result.details.message).toBe('Fix bug');
    expect(result.details.all).toBeUndefined();
    expect(result.details.amend).toBeUndefined();
  });

  it('should commit with -a flag when all=true', async () => {
    const ctx = mockCtx({ stdout: 'Committed all', code: 0 });
    const result = await commit.execute({ message: 'Wip', all: true }, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('git', ['commit', '-a', '-m', 'Wip'], { cwd: '/test' });
    expect(result.isError).toBe(false);
    expect(result.details.all).toBe(true);
  });

  it('should commit with --amend when amend=true', async () => {
    const ctx = mockCtx({ stdout: 'Amended', code: 0 });
    const result = await commit.execute({ message: ' Amend', amend: true }, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('git', ['commit', '--amend', '-m', ' Amend'], { cwd: '/test' });
    expect(result.isError).toBe(false);
    expect(result.details.amend).toBe(true);
  });

  it('should combine -a and --amend', async () => {
    const ctx = mockCtx({ stdout: 'Amended all', code: 0 });
    const result = await commit.execute({ message: 'Final', all: true, amend: true }, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('git', ['commit', '-a', '--amend', '-m', 'Final'], { cwd: '/test' });
    expect(result.isError).toBe(false);
  });

  it('should return error when commit fails', async () => {
    const ctx = mockCtx({ stderr: 'nothing to commit', code: 1 });
    const result = await commit.execute({ message: 'Oops' }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('❌ git commit failed');
    expect(result.details.exitCode).toBe(1);
  });

  it('should handle exception', async () => {
    const ctx = mockCtx();
    (ctx.exec as any).mockRejectedValue(new Error('git not installed'));
    const result = await commit.execute({ message: 'Test' }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('❌ Error: git not installed');
  });
});
