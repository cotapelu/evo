import { describe, it, expect, vi, beforeEach } from 'vitest';
import scripts from '../../../../../extensions/capability-system/plugins/dev/capabilities/scripts.js';

function mockCtx(opts: { stdout?: string; stderr?: string; code?: number } = {}) {
  return {
    cwd: '/test',
    exec: vi.fn(async () => ({ stdout: opts.stdout || '', stderr: opts.stderr || '', code: opts.code ?? 0, killed: false })),
  };
}

describe('dev.scripts capability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list npm scripts', async () => {
    const ctx = mockCtx({ stdout: 'Scripts: build, test', code: 0 });
    const result = await scripts.execute({ action: 'list' }, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('npm', ['run'], { cwd: '/test' });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('Scripts: build, test');
    expect(result.details.action).toBe('list');
  });

  it('should run a specific script', async () => {
    const ctx = mockCtx({ stdout: 'Running lint', code: 0 });
    const result = await scripts.execute({ action: 'run', script: 'lint' }, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('npm', ['run', 'lint'], { cwd: '/test' });
    expect(result.details.action).toBe('run');
    expect(result.details.script).toBe('lint');
  });

  it('should return error if script missing when action=run', async () => {
    const result = await scripts.execute({ action: 'run' } as any, mockCtx());
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("❌ Error: script required when action='run'");
  });

  it('should return error when npm run fails', async () => {
    const ctx = mockCtx({ stderr: 'npm error', code: 1 });
    const result = await scripts.execute({ action: 'run', script: 'bad' }, ctx);
    expect(result.isError).toBe(true);
    expect(result.details.exitCode).toBe(1);
  });

  it('should handle exec exception', async () => {
    const ctx = mockCtx();
    (ctx.exec as any).mockRejectedValue(new Error('npm missing'));
    const result = await scripts.execute({ action: 'list' }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error: npm missing');
  });

  it('should use process.cwd when ctx.cwd undefined', async () => {
    const realCwd = process.cwd();
    const ctx = {
      exec: vi.fn(async () => ({ stdout: 'OK', stderr: '', code: 0, killed: false })),
    } as any;
    const result = await scripts.execute({ action: 'list' }, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('npm', ['run'], { cwd: realCwd });
  });
});
