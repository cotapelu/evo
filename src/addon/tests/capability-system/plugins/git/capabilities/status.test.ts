import { describe, it, expect, vi, beforeEach } from 'vitest';
import status from '../../../../../extensions/capability-system/plugins/git/capabilities/status.ts';

function mockCtx(opts: { stdout?: string; stderr?: string; code?: number } = {}) {
  return {
    cwd: '/test',
    exec: vi.fn(async () => ({ stdout: opts.stdout || '', stderr: opts.stderr || '', code: opts.code ?? 0, killed: false })),
  };
}

describe('git.status capability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse porcelain output and return summary', async () => {
    const ctx = mockCtx({
      stdout: '## main...origin/main\n M file1.ts\nA  file2.js\n?? file3.txt\n',
      code: 0,
    });
    const result = await status.execute({}, ctx);
    expect(result.isError).toBe(false);
    expect(result.isError).toBe(false);
    const text = result.content[0].text;
    expect(text).toContain('Branch: main');
    expect(text).toContain('Staged: 1');
    expect(text).toContain('Unstaged: 1');
    expect(text).toContain('Untracked: 1');
    expect(result.details.branch).toBe('main');
    expect(result.details.staged).toHaveLength(1);
    expect(result.details.staged[0]).toContain('A  file2.js');
    expect(result.details.unstaged).toHaveLength(1);
    expect(result.details.unstaged[0]).toContain('M file1.ts');
    expect(result.details.untracked).toEqual(['file3.txt']);
  });

  it('should handle empty output', async () => {
    const ctx = mockCtx({ stdout: '', code: 0 });
    const result = await status.execute({}, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('Branch: (unknown)\nStaged: 0\nUnstaged: 0\nUntracked: 0');
    expect(result.details.branch).toBe('(unknown)');
    expect(result.details.staged).toEqual([]);
    expect(result.details.unstaged).toEqual([]);
    expect(result.details.untracked).toEqual([]);
  });

  it('should return error when git fails', async () => {
    const ctx = mockCtx({ stderr: 'fatal: not a git repository', code: 128 });
    const result = await status.execute({}, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('❌ git status failed');
    expect(result.details.exitCode).toBe(128);
  });

  it('should handle exception', async () => {
    const ctx = mockCtx();
    (ctx.exec as any).mockRejectedValue(new Error('git not found'));
    const result = await status.execute({}, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('❌ Error: git not found');
  });
});
