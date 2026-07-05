import { describe, it, expect, vi, beforeEach } from 'vitest';
import push from '../../../../../extensions/capability-system/plugins/git/capabilities/push.ts';

function mockCtx(opts: { stdout?: string; stderr?: string; code?: number } = {}) {
  return {
    cwd: '/test',
    exec: vi.fn(async () => ({ stdout: opts.stdout || '', stderr: opts.stderr || '', code: opts.code ?? 0, killed: false })),
  };
}

describe('git.push capability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should push without flags', async () => {
    const ctx = mockCtx({ stdout: 'Pushed', code: 0 });
    const result = await push.execute({}, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('git', ['push', 'origin'], { cwd: '/test' });
    expect(result.isError).toBe(false);
    expect(result.details).toEqual({ remote: 'origin', branch: undefined, setUpstream: undefined });
  });

  it('should push with remote and branch', async () => {
    const ctx = mockCtx({ stdout: 'Pushed to feature', code: 0 });
    const result = await push.execute({ remote: 'upstream', branch: 'feat' }, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('git', ['push', 'upstream', 'feat'], { cwd: '/test' });
    expect(result.isError).toBe(false);
    expect(result.details).toEqual({ remote: 'upstream', branch: 'feat', setUpstream: undefined });
  });

  it('should push with setUpstream flag', async () => {
    const ctx = mockCtx({ stdout: 'Set upstream', code: 0 });
    const result = await push.execute({ remote: 'origin', branch: 'main', setUpstream: true }, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('git', ['push', '-u', 'origin', 'main'], { cwd: '/test' });
    expect(result.isError).toBe(false);
    expect(result.details.setUpstream).toBe(true);
  });

  it('should handle push failure', async () => {
    const ctx = mockCtx({ stderr: 'error: failed to push', code: 1 });
    const result = await push.execute({}, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('❌ git push failed');
    expect(result.details.exitCode).toBe(1);
  });

  it('should handle execution exception', async () => {
    const ctx = mockCtx();
    (ctx.exec as any).mockRejectedValueOnce(new Error('Network down'));
    const result = await push.execute({}, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('❌ Error: Network down');
  });
});
