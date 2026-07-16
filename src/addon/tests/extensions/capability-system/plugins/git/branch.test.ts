import { describe, it, expect, vi, beforeEach } from 'vitest';
import branchModule from '../../../../../extensions/capability-system/plugins/git/capabilities/branch.ts';

describe('git.branch capability', () => {
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

  it('execute: action=list lists all branches', async () => {
    mockExec.mockResolvedValueOnce({ code: 0, stdout: '  main\n  feature', stderr: '' });
    const ctx = createMockCtx();
    const result = await branchModule.execute({ action: 'list' }, ctx);
    expect(result.isError).toBe(false);
    expect(mockExec).toHaveBeenCalledWith('git', ['branch', '-a'], expect.anything());
  });

  it('execute: action=create with name creates branch', async () => {
    const ctx = createMockCtx();
    const result = await branchModule.execute({ action: 'create', name: 'feature' }, ctx);
    expect(result.isError).toBe(false);
    expect(mockExec).toHaveBeenCalledWith('git', ['branch', 'feature'], expect.anything());
  });

  it('execute: action=create without name returns error', async () => {
    const ctx = createMockCtx();
    const result = await branchModule.execute({ action: 'create' }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('name required for create');
  });

  it('execute: action=delete with name deletes branch', async () => {
    const ctx = createMockCtx();
    const result = await branchModule.execute({ action: 'delete', name: 'old' }, ctx);
    expect(result.isError).toBe(false);
    expect(mockExec).toHaveBeenCalledWith('git', ['branch', '-d', 'old'], expect.anything());
  });

  it('execute: action=delete without name returns error', async () => {
    const ctx = createMockCtx();
    const result = await branchModule.execute({ action: 'delete' }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('name required for delete');
  });

  it('execute: git command failure returns error', async () => {
    mockExec.mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'error' });
    const ctx = createMockCtx();
    const result = await branchModule.execute({ action: 'list' }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('git branch failed');
  });

  it('execute: exception thrown returns error', async () => {
    mockExec.mockRejectedValueOnce(new Error('exec failed'));
    const ctx = createMockCtx();
    const result = await branchModule.execute({ action: 'list' }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error: exec failed');
  });
});
