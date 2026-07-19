import { describe, it, expect, vi, beforeEach } from 'vitest';
import pull from '../../../../../extensions/capability-system/plugins/git/capabilities/pull.ts';

function mockCwdCtx(cwd?: string, stdout?: string, stderr?: string, code?: number) {
  return {
    cwd: cwd,
    exec: vi.fn(async () => ({ stdout: stdout || '', stderr: stderr || '', code: code ?? 0, killed: false })),
  };
}

describe('git.pull branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses fallback message when stdout is empty', async () => {
    const ctx = mockCwdCtx('/test', '', '', 0);
    const result = await pull.execute({}, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('✅ Pulled from origin');
    expect(result.details).toEqual({ remote: 'origin', branch: undefined });
  });

  it('fallback message includes branch when provided', async () => {
    const ctx = mockCwdCtx('/test', '', '', 0);
    const result = await pull.execute({ remote: 'upstream', branch: 'main' }, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('✅ Pulled from upstream/main');
    expect(result.details).toEqual({ remote: 'upstream', branch: 'main' });
  });

  it('falls back to process.cwd when ctx.cwd is undefined', async () => {
    // Mock process.cwd
    const originalCwd = process.cwd;
    process.cwd = () => '/default-cwd';
    try {
      const ctx = mockCwdCtx(undefined, 'output', '', 0);
      // cwd is undefined in ctx
      expect(ctx.cwd).toBeUndefined();
      const result = await pull.execute({}, ctx);
      expect(result.isError).toBe(false);
      // Should have used process.cwd() as cwd for exec
      expect(ctx.exec).toHaveBeenCalledWith('git', ['pull', 'origin'], { cwd: '/default-cwd' });
    } finally {
      process.cwd = originalCwd;
    }
  });
});
