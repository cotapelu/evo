import { describe, it, expect, vi, beforeEach } from 'vitest';
import checkoutModule from '../../../../../extensions/capability-system/plugins/git/capabilities/checkout.ts';

describe('git.checkout capability', () => {
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

  it('execute: checkout branch without create', async () => {
    const ctx = createMockCtx();
    const result = await checkoutModule.execute({ branch: 'main' }, ctx);
    expect(result.isError).toBe(false);
    expect(mockExec).toHaveBeenCalledWith('git', ['checkout', 'main'], expect.anything());
  });

  it('execute: checkout with create flag creates new branch', async () => {
    mockExec.mockResolvedValueOnce({ code: 0, stdout: 'Switched to a new branch', stderr: '' });
    const ctx = createMockCtx();
    const result = await checkoutModule.execute({ branch: 'feature', create: true }, ctx);
    expect(result.isError).toBe(false);
    expect(mockExec).toHaveBeenCalledWith('git', ['checkout', '-b', 'feature'], expect.anything());
  });

  it('execute: git command failure returns error', async () => {
    mockExec.mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'error' });
    const ctx = createMockCtx();
    const result = await checkoutModule.execute({ branch: 'main' }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('git checkout failed');
  });

  it('execute: exception thrown returns error', async () => {
    mockExec.mockRejectedValueOnce(new Error('exec failed'));
    const ctx = createMockCtx();
    const result = await checkoutModule.execute({ branch: 'main' }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error: exec failed');
  });
});
