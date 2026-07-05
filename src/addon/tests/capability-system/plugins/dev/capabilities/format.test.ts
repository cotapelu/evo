import { describe, it, expect, vi, beforeEach } from 'vitest';
import format from '../../../../../extensions/capability-system/plugins/dev/capabilities/format.js';

function mockCtx(opts: { stdout?: string; stderr?: string; code?: number } = {}) {
  return {
    cwd: '/test',
    exec: vi.fn(async () => ({ stdout: opts.stdout || '', stderr: opts.stderr || '', code: opts.code ?? 0, killed: false })),
  };
}

describe('dev.format capability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run prettier on provided files', async () => {
    const ctx = mockCtx({ stdout: 'Formatted', code: 0 });
    const result = await format.execute({ files: ['src/index.ts'] }, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('npx', ['prettier', '--write', 'src/index.ts'], { cwd: '/test' });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('Formatted');
    expect(result.details.files).toEqual(['src/index.ts']);
  });

  it('should handle multiple files', async () => {
    const ctx = mockCtx({ stdout: 'Formatted 2 files', code: 0 });
    const result = await format.execute({ files: ['a.ts', 'b.ts'] }, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('npx', ['prettier', '--write', 'a.ts', 'b.ts'], { cwd: '/test' });
    expect(result.details.files).toEqual(['a.ts', 'b.ts']);
  });

  it('should return error if files array is empty', async () => {
    const result = await format.execute({ files: [] }, mockCtx());
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('❌ Error: files array required');
  });

  it('should return error if files missing', async () => {
    // @ts-ignore - omit files
    const result = await format.execute({}, mockCtx());
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('❌ Error: files array required');
  });

  it('should return error when npm exits non-zero', async () => {
    const ctx = mockCtx({ stderr: 'prettier error', code: 1 });
    const result = await format.execute({ files: ['x.ts'] }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('prettier error');
  });

  it('should handle exec exception', async () => {
    const ctx = mockCtx();
    (ctx.exec as any).mockRejectedValue(new Error('npx not found'));
    const result = await format.execute({ files: ['x.ts'] }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error: npx not found');
  });

  it('should use process.cwd when ctx.cwd undefined', async () => {
    const realCwd = process.cwd();
    const ctx = {
      exec: vi.fn(async () => ({ stdout: 'OK', stderr: '', code: 0, killed: false })),
    } as any;
    const result = await format.execute({ files: ['x.ts'] }, ctx);
    expect(ctx.exec).toHaveBeenCalledWith('npx', ['prettier', '--write', 'x.ts'], { cwd: realCwd });
  });
});
