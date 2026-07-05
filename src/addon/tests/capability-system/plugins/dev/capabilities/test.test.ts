import { describe, it, expect, vi, beforeEach } from 'vitest';
import testCap from '../../../../../extensions/capability-system/plugins/dev/capabilities/test.js';

function mockCtx(opts: { stdout?: string; stderr?: string; code?: number } = {}) {
  return {
    cwd: '/test',
    exec: vi.fn(async () => ({ stdout: opts.stdout || '', stderr: opts.stderr || '', code: opts.code ?? 0, killed: false })),
  };
}

describe('dev.test capability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run npm test by default', async () => {
    const ctx = mockCtx({ stdout: 'Tests passed', code: 0 });
    const result = await testCap.execute({}, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('bash', ['-c', 'npm test'], { cwd: '/test' });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('Tests passed');
    expect(result.details.files).toBeUndefined();
    expect(result.details.watch).toBeUndefined();
  });

  it('should run npm test with specific files', async () => {
    const ctx = mockCtx({ stdout: '1 passing', code: 0 });
    const result = await testCap.execute({ files: ['src/foo.test.ts'] }, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('bash', ['-c', 'npm test -- "src/foo.test.ts"'], { cwd: '/test' });
    expect(result.details.files).toEqual(['src/foo.test.ts']);
  });

  it('should add watch flag when watch=true', async () => {
    const ctx = mockCtx({ stdout: 'watching...', code: 0 });
    const result = await testCap.execute({ watch: true }, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('bash', ['-c', 'npm test -- --watch'], { cwd: '/test' });
    expect(result.details.watch).toBe(true);
  });

  it('should combine files and watch', async () => {
    const ctx = mockCtx({ stdout: 'watching files...', code: 0 });
    const result = await testCap.execute({ files: ['a.test.ts', 'b.test.ts'], watch: true }, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('bash', ['-c', 'npm test -- "a.test.ts" "b.test.ts" -- --watch'], { cwd: '/test' });
  });

  it('should handle non-zero exit', async () => {
    const ctx = mockCtx({ stderr: 'Tests failed', code: 1 });
    const result = await testCap.execute({}, ctx);
    expect(result.isError).toBe(true);
    expect(result.details.exitCode).toBe(1);
  });

  it('should handle exec exception', async () => {
    const ctx = mockCtx();
    (ctx.exec as any).mockRejectedValue(new Error('bash not found'));
    const result = await testCap.execute({}, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error: bash not found');
  });

  it('should use process.cwd when ctx.cwd undefined', async () => {
    const realCwd = process.cwd();
    const ctx = {
      exec: vi.fn(async () => ({ stdout: 'OK', stderr: '', code: 0, killed: false })),
    } as any;
    await testCap.execute({}, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('bash', ['-c', 'npm test'], { cwd: realCwd });
  });
});
