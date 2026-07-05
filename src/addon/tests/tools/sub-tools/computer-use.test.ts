import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeLs,
  executeFind,
  executeGrep,
  executeRead,
} from '../../../extensions/tools/sub-tools/computer-use.js';

function mockExec(result: { stdout: string; stderr: string; code: number; killed: boolean }) {
  return {
    exec: vi.fn(async (cmd: string, args: string[], opts: any) => {
      return { ...result, signal: undefined };
    }),
  };
}

function makeCtx(result: ReturnType<typeof mockExec>) {
  return {
    exec: result.exec,
  };
}

describe('Computer Use Sub-Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeLs', () => {
    it('should list directory default (cwd)', async () => {
      const ctx = makeCtx(mockExec({ stdout: 'file1\nfile2', stderr: '', code: 0, killed: false }));
      const result = await executeLs({}, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('ls', ['-l'], { cwd: '/cwd', signal: undefined });
      expect(result.isError).toBe(false);
    });

    it('should list specific path', async () => {
      const ctx = makeCtx(mockExec({ stdout: 'dir:', stderr: '', code: 0, killed: false }));
      await executeLs({ path: '/tmp' }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('ls', ['-l', '/tmp'], { cwd: '/tmp', signal: undefined });
    });

    it('should handle recursive', async () => {
      const ctx = makeCtx(mockExec({ stdout: 'recursive output', stderr: '', code: 0, killed: false }));
      await executeLs({ recursive: true }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('ls', ['-lR'], { cwd: '/cwd', signal: undefined });
    });

    it('should handle all (-la)', async () => {
      const ctx = makeCtx(mockExec({ stdout: 'including hidden', stderr: '', code: 0, killed: false }));
      await executeLs({ all: true }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('ls', ['-la'], { cwd: '/cwd', signal: undefined });
    });
  });

  describe('executeFind', () => {
    it('should find with pattern and default cwd', async () => {
      const ctx = makeCtx(mockExec({ stdout: './a.ts\n./b.ts', stderr: '', code: 0, killed: false }));
      const result = await executeFind({ pattern: '*.ts' }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('find', ['/cwd', '-name', '*.ts'], { cwd: '/cwd', signal: undefined });
      expect(result.isError).toBe(false);
    });

    it('should support custom path and maxDepth', async () => {
      const ctx = makeCtx(mockExec({ stdout: 'found', stderr: '', code: 0, killed: false }));
      await executeFind({ pattern: '*.js', path: '/src', maxDepth: 3 }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('find', ['/src', '-maxdepth', '3', '-name', '*.js'], { cwd: '/cwd', signal: undefined });
    });
  });

  describe('executeGrep', () => {
    it('should grep recursively with pattern', async () => {
      const ctx = makeCtx(mockExec({ stdout: 'match', stderr: '', code: 0, killed: false }));
      await executeGrep({ pattern: 'foo' }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('grep', ['-r', 'foo'], { cwd: '/cwd', signal: undefined });
    });

    it('should add include and exclude', async () => {
      const ctx = makeCtx(mockExec({ stdout: 'matches', stderr: '', code: 0, killed: false }));
      await executeGrep({ pattern: 'bar', include: '*.ts', exclude: 'node_modules' }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('grep', ['--include', '*.ts', '--exclude', 'node_modules', '-r', 'bar'], { cwd: '/cwd', signal: undefined });
    });

    it('should add -i for ignoreCase', async () => {
      const ctx = makeCtx(mockExec({ stdout: 'MATCH', stderr: '', code: 0, killed: false }));
      await executeGrep({ pattern: 'test', ignoreCase: true }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('grep', ['-i', '-r', 'test'], { cwd: '/cwd', signal: undefined });
    });
  });

  describe('executeRead', () => {
    it('should cat file without offset/limit', async () => {
      const ctx = makeCtx(mockExec({ stdout: 'full content', stderr: '', code: 0, killed: false }));
      await executeRead({ path: 'file.txt' }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('bash', ['-c', "cat 'file.txt'"], { cwd: '/cwd', signal: undefined });
    });

    it('should apply offset (tail -n +N)', async () => {
      const ctx = makeCtx(mockExec({ stdout: 'from line 5', stderr: '', code: 0, killed: false }));
      await executeRead({ path: 'file.txt', offset: 5 }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('bash', ['-c', "cat 'file.txt' | tail -n +5"], { cwd: '/cwd', signal: undefined });
    });

    it('should apply limit (head -n N)', async () => {
      const ctx = makeCtx(mockExec({ stdout: 'first 10', stderr: '', code: 0, killed: false }));
      await executeRead({ path: 'file.txt', limit: 10 }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('bash', ['-c', "cat 'file.txt' | head -n 10"], { cwd: '/cwd', signal: undefined });
    });

    it('should apply both offset and limit', async () => {
      const ctx = makeCtx(mockExec({ stdout: 'slice', stderr: '', code: 0, killed: false }));
      await executeRead({ path: 'file.txt', offset: 10, limit: 20 }, '/cwd', undefined, ctx);
      expect(ctx.exec).toHaveBeenCalledWith('bash', ['-c', "cat 'file.txt' | tail -n +10 | head -n 20"], { cwd: '/cwd', signal: undefined });
    });
  });
});
