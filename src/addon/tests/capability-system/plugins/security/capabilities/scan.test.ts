import { describe, it, expect, vi, beforeEach } from 'vitest';
import scan from '../../../../../extensions/capability-system/plugins/security/capabilities/scan.js';

function mockCtx(opts: { stdout?: string; stderr?: string; code?: number } = {}) {
  return {
    cwd: '/test',
    exec: vi.fn(async () => ({ stdout: opts.stdout || '', stderr: opts.stderr || '', code: opts.code ?? 0, killed: false })),
  };
}

describe('security.scan capability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run secret scanner with default cwd', async () => {
    const ctx = mockCtx({ stdout: 'Scan complete', code: 0 });
    const result = await scan.execute({}, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('npx', ['secret-scanner', '--path', '/test'], { cwd: '/test' });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('Scan complete');
    expect(result.details.path).toBe('/test');
  });

  it('should use custom path parameter', async () => {
    const ctx = mockCtx({ stdout: 'Scanned /src', code: 0 });
    const result = await scan.execute({ path: '/src' }, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('npx', ['secret-scanner', '--path', '/src'], { cwd: '/test' });
    expect(result.details.path).toBe('/src');
  });

  it('should handle scan errors (non-zero exit)', async () => {
    const ctx = mockCtx({ stderr: 'Secrets found!', code: 1 });
    const result = await scan.execute({}, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Secrets found!');
  });

  it('should handle exception (e.g., npx not found)', async () => {
    const ctx = mockCtx();
    (ctx.exec as any).mockRejectedValue(new Error('npx: command not found'));
    const result = await scan.execute({}, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error: npx: command not found');
  });

  it('should use fallback message when both stdout and stderr empty', async () => {
    const ctx = mockCtx({ stdout: '', stderr: '', code: 0 });
    const result = await scan.execute({}, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('Scan complete');
  });

  it('should use process.cwd when ctx.cwd is undefined', async () => {
    const realCwd = process.cwd();
    const ctx = {
      exec: vi.fn(async () => ({ stdout: 'OK', stderr: '', code: 0, killed: false })),
    } as any;
    const result = await scan.execute({}, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('npx', ['secret-scanner', '--path', realCwd], { cwd: realCwd });
  });
});
