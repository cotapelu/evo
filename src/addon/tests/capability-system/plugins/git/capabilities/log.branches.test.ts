import { describe, it, expect, vi, beforeEach } from 'vitest';
import log from '../../../../../extensions/capability-system/plugins/git/capabilities/log.ts';

function mockCwdCtx(cwd?: string, stdout?: string, stderr?: string, code?: number) {
  return {
    cwd: cwd,
    exec: vi.fn(async () => ({ stdout: stdout || '', stderr: stderr || '', code: code ?? 0, killed: false })),
  };
}

describe('git.log branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to process.cwd when ctx.cwd is undefined', async () => {
    const originalCwd = process.cwd;
    process.cwd = () => '/default-cwd';
    try {
      const ctx = mockCwdCtx(undefined, 'commit', '', 0);
      const result = await log.execute({}, ctx);
      expect(result.isError).toBe(false);
      expect(ctx.exec).toHaveBeenCalledWith('git', ['log', '-10', '--oneline', '--graph', '--decorate'], { cwd: '/default-cwd' });
    } finally {
      process.cwd = originalCwd;
    }
  });

  it('uses default count 10 when params.count is 0 (falsy)', async () => {
    const ctx = mockCwdCtx('/test', 'commit', '', 0);
    // count=0 should fallback to 10 due to falsy check
    const result = await log.execute({ count: 0 }, ctx);
    expect(result.isError).toBe(false);
    expect(ctx.exec).toHaveBeenCalledWith('git', ['log', '-10', '--oneline', '--graph', '--decorate'], { cwd: '/test' });
  });

  it('handles empty stdout gracefully', async () => {
    const ctx = mockCwdCtx('/test', '', '', 0);
    const result = await log.execute({}, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('');
    expect(result.details.count).toBe(0);
  });
});
