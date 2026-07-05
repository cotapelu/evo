import { describe, it, expect, vi, beforeEach } from 'vitest';
import log from '../../../../../extensions/capability-system/plugins/git/capabilities/log.ts';

function mockCtx(opts: { stdout?: string; stderr?: string; code?: number } = {}) {
  return {
    cwd: '/test',
    exec: vi.fn(async () => ({ stdout: opts.stdout || '', stderr: opts.stderr || '', code: opts.code ?? 0, killed: false })),
  };
}

describe('git.log capability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return commit log', async () => {
    const ctx = mockCtx({ stdout: 'commit 1\ncommit 2', code: 0 });
    const result = await log.execute({}, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('git', ['log', '-10', '--oneline', '--graph', '--decorate'], { cwd: '/test' });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('commit 1\ncommit 2');
    expect(result.details.count).toBe(2);
  });

  it('should respect custom count', async () => {
    const ctx = mockCtx({ stdout: 'c1\nc2\nc3', code: 0 });
    const result = await log.execute({ count: 3 }, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('git', ['log', '-3', '--oneline', '--graph', '--decorate'], { cwd: '/test' });
    expect(result.isError).toBe(false);
    expect(result.details.count).toBe(3);
  });

  it('should handle log failure', async () => {
    const ctx = mockCtx({ stderr: 'fatal: not a git repo', code: 1 });
    const result = await log.execute({}, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('❌ git log failed');
    expect(result.details.exitCode).toBe(1);
  });

  it('should handle execution exception', async () => {
    const ctx = mockCtx();
    (ctx.exec as any).mockRejectedValueOnce(new Error('git not installed'));
    const result = await log.execute({}, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('❌ Error: git not installed');
  });
});
