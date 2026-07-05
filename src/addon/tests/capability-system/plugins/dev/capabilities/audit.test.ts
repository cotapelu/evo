import { describe, it, expect, vi, beforeEach } from 'vitest';
import audit from '../../../../../extensions/capability-system/plugins/dev/capabilities/audit.js';

function mockCtx(opts: { stdout?: string; stderr?: string; code?: number } = {}) {
  return {
    cwd: '/test',
    exec: vi.fn(async () => ({ stdout: opts.stdout || '', stderr: opts.stderr || '', code: opts.code ?? 0, killed: false })),
  };
}

describe('dev.audit capability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run npm audit and return stdout', async () => {
    const ctx = mockCtx({ stdout: 'audit results', code: 0 });
    const result = await audit.execute({}, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('npm', ['audit'], { cwd: '/test' });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('audit results');
    expect(result.details.exitCode).toBe(0);
    expect(result.details.fix).toBeUndefined();
  });

  it('should run npm audit fix when fix=true', async () => {
    const ctx = mockCtx({ stdout: 'fixed', code: 0 });
    const result = await audit.execute({ fix: true }, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('npm', ['audit', '--', 'fix'], { cwd: '/test' });
    expect(result.details.fix).toBe(true);
  });

  it('should return stderr when no stdout and non-zero exit', async () => {
    const ctx = mockCtx({ stderr: 'vulnerabilities found', code: 1 });
    const result = await audit.execute({}, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('vulnerabilities found');
  });

  it('should return fallback message when both stdout and stderr empty', async () => {
    const ctx = mockCtx({ stdout: '', stderr: '', code: 0 });
    const result = await audit.execute({}, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('Audit complete');
  });

  it('should handle exec error (exception)', async () => {
    const ctx = mockCtx();
    (ctx.exec as any).mockRejectedValue(new Error('npm not found'));
    const result = await audit.execute({}, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error: npm not found');
  });

  it('should use process.cwd when ctx.cwd is undefined', async () => {
    const realCwd = process.cwd();
    const ctx = {
      exec: vi.fn(async () => ({ stdout: 'OK', stderr: '', code: 0, killed: false })),
    } as any;
    const result = await audit.execute({}, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('npm', ['audit'], { cwd: realCwd });
  });
});
