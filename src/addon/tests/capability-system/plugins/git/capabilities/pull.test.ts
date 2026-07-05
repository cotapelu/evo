import { describe, it, expect, vi, beforeEach } from 'vitest';
import pull from '../../../../../extensions/capability-system/plugins/git/capabilities/pull.ts';

function mockCtx(opts: { stdout?: string; stderr?: string; code?: number } = {}) {
  return {
    cwd: '/test',
    exec: vi.fn(async () => ({ stdout: opts.stdout || '', stderr: opts.stderr || '', code: opts.code ?? 0, killed: false })),
  };
}

describe('git.pull capability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pull from remote without branch', async () => {
    const ctx = mockCtx({ stdout: 'Updating...', code: 0 });
    const result = await pull.execute({}, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('git', ['pull', 'origin'], { cwd: '/test' });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('Updating...');
    expect(result.details).toEqual({ remote: 'origin', branch: undefined });
  });

  it('should pull from specific remote and branch', async () => {
    const ctx = mockCtx({ stdout: 'Updated', code: 0 });
    const result = await pull.execute({ remote: 'upstream', branch: 'main' }, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('git', ['pull', 'upstream', 'main'], { cwd: '/test' });
    expect(result.isError).toBe(false);
    expect(result.details).toEqual({ remote: 'upstream', branch: 'main' });
  });

  it('should handle pull failure (non-zero exit)', async () => {
    const ctx = mockCtx({ stderr: 'fatal: Could not fetch', code: 1 });
    const result = await pull.execute({ remote: 'origin' }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('❌ git pull failed');
    expect(result.details.exitCode).toBe(1);
    expect(result.details.error).toBe('fatal: Could not fetch');
  });

  it('should handle unexpected exception', async () => {
    const ctx = mockCtx();
    (ctx.exec as any).mockRejectedValueOnce(new Error('Network error'));
    const result = await pull.execute({}, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('❌ Error: Network error');
    expect(result.details.error).toBe('Network error');
  });
});
