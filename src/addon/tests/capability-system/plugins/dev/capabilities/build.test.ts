import { describe, it, expect, vi, beforeEach } from 'vitest';
import build from '../../../../../extensions/capability-system/plugins/dev/capabilities/build.js';

function mockCtx(opts: { stdout?: string; stderr?: string; code?: number } = {}) {
  return {
    cwd: '/test',
    exec: vi.fn(async () => ({ stdout: opts.stdout || '', stderr: opts.stderr || '', code: opts.code ?? 0, killed: false })),
  };
}

describe('dev.build capability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run npm run build and return stdout', async () => {
    const ctx = mockCtx({ stdout: 'Build OK', code: 0 });
    const result = await build.execute({}, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('npm', ['run', 'build'], { cwd: '/test' });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('Build OK');
    expect(result.details.exitCode).toBe(0);
  });

  it('should return stderr when no stdout', async () => {
    const ctx = mockCtx({ stderr: 'Build failed', code: 1 });
    const result = await build.execute({}, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Build failed');
  });

  it('should use fallback message when both stdout and stderr empty', async () => {
    const ctx = mockCtx({ stdout: '', stderr: '', code: 0 });
    const result = await build.execute({}, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('Build complete');
  });

  it('should handle exec error (exception)', async () => {
    const ctx = mockCtx();
    (ctx.exec as any).mockRejectedValue(new Error('npm not found'));
    const result = await build.execute({}, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error: npm not found');
  });

  it('should use process.cwd when ctx.cwd is undefined', async () => {
    const realCwd = process.cwd();
    const ctx = {
      exec: vi.fn(async () => ({ stdout: 'OK', stderr: '', code: 0, killed: false })),
    } as any;
    const result = await build.execute({}, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('npm', ['run', 'build'], { cwd: realCwd });
  });
});
