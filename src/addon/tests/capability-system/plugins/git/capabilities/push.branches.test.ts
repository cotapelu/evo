import { describe, it, expect, vi, beforeEach } from 'vitest';
import push from '../../../../../extensions/capability-system/plugins/git/capabilities/push.ts';

function mockCwdCtx(cwd?: string, stdout?: string, stderr?: string, code?: number) {
  return {
    cwd: cwd,
    exec: vi.fn(async () => ({ stdout: stdout || '', stderr: stderr || '', code: code ?? 0, killed: false })),
  };
}

describe('git.push branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses fallback message when stdout is empty', async () => {
    const ctx = mockCwdCtx('/test', '', '', 0);
    const result = await push.execute({}, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('✅ Pushed to origin');
    expect(result.details).toEqual({ remote: 'origin', branch: undefined, setUpstream: undefined });
  });

  it('fallback message includes branch when provided', async () => {
    const ctx = mockCwdCtx('/test', '', '', 0);
    const result = await push.execute({ remote: 'upstream', branch: 'main' }, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('✅ Pushed to upstream/main');
    expect(result.details).toEqual({ remote: 'upstream', branch: 'main', setUpstream: undefined });
  });

  it('falls back to process.cwd when ctx.cwd is undefined', async () => {
    const originalCwd = process.cwd;
    process.cwd = () => '/default-cwd';
    try {
      const ctx = mockCwdCtx(undefined, 'output', '', 0);
      expect(ctx.cwd).toBeUndefined();
      const result = await push.execute({}, ctx);
      expect(result.isError).toBe(false);
      expect(ctx.exec).toHaveBeenCalledWith('git', ['push', 'origin'], { cwd: '/default-cwd' });
    } finally {
      process.cwd = originalCwd;
    }
  });
});
