import { describe, it, expect, vi, beforeEach } from 'vitest';
import addModule from '../../../../../extensions/capability-system/plugins/git/capabilities/add.ts';

describe('git.add capability', () => {
  let mockExec: any;

  beforeEach(() => {
    mockExec = vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' });
  });

  function createMockCtx(cwd?: string) {
    return {
      cwd: cwd || process.cwd(),
      exec: mockExec,
    };
  }

  it('execute: all=true stages all changes', async () => {
    const ctx = createMockCtx();
    const result = await addModule.execute({ all: true }, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Staged all changes');
    expect(mockExec).toHaveBeenCalledWith('git', ['add', '-A'], expect.anything());
  });

  it('execute: files array stages specific files', async () => {
    const ctx = createMockCtx();
    const result = await addModule.execute({ files: ['a.ts', 'b.ts'] }, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Staged a.ts, b.ts');
    expect(mockExec).toHaveBeenCalledWith('git', ['add', 'a.ts', 'b.ts'], expect.anything());
  });

  it('execute: no files or all returns error', async () => {
    const ctx = createMockCtx();
    const result = await addModule.execute({}, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Must specify either 'files' array or 'all: true'");
  });

  it('execute: git command failure returns error', async () => {
    const ctx = createMockCtx();
    mockExec.mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'error msg' });
    const result = await addModule.execute({ all: true }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('git add failed');
  });

  it('execute: exception thrown returns error', async () => {
    const ctx = createMockCtx();
    mockExec.mockRejectedValueOnce(new Error('exec failed'));
    const result = await addModule.execute({ all: true }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error: exec failed');
  });
});
