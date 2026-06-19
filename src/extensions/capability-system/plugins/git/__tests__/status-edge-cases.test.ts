#!/usr/bin/env node
/**
 * Git Status Additional Edge Case Tests
 * Target: increase branch coverage for parser logic.
 */

import { describe, it, expect, vi } from 'vitest';
import { execute } from '../capabilities/status.js';

function createMockCtx(cwd?: string, execResult?: any) {
  const mockExec = vi.fn();
  if (execResult !== undefined) {
    mockExec.mockResolvedValue(execResult);
  } else {
    mockExec.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
  }
  return { cwd: cwd || '/mock/repo', exec: mockExec as any };
}

describe('git.status edge cases', () => {

  it('should handle empty output', async () => {
    const mockCtx = createMockCtx('/test', { code: 0, stdout: '', stderr: '' });
    const result = await execute({}, mockCtx);
    expect(result.isError).toBe(false);
    expect(result.details.branch).toBe('(unknown)');
    expect(result.details.staged).toEqual([]);
    expect(result.details.unstaged).toEqual([]);
    expect(result.details.untracked).toEqual([]);
  });

  it('should handle branch-only line (no file changes)', async () => {
    const mockCtx = createMockCtx('/test', { code: 0, stdout: '## main\n', stderr: '' });
    const result = await execute({}, mockCtx);
    expect(result.isError).toBe(false);
    expect(result.details.branch).toBe('main');
    expect(result.details.staged).toEqual([]);
    expect(result.details.unstaged).toEqual([]);
    expect(result.details.untracked).toEqual([]);
  });

  it('should handle only untracked files (no branch line)', async () => {
    const mockCtx = createMockCtx('/test', { code: 0, stdout: '?? file1.ts\n?? file2.ts\n', stderr: '' });
    const result = await execute({}, mockCtx);
    expect(result.isError).toBe(false);
    expect(result.details.branch).toBe('(unknown)');
    expect(result.details.staged).toEqual([]);
    expect(result.details.unstaged).toEqual([]);
    expect(result.details.untracked).toEqual(['file1.ts', 'file2.ts']);
  });

  it('should handle mixed staged (renamed and modified) and unstaged', async () => {
    const mockCtx = createMockCtx('/test', {
      code: 0,
      stdout: 'R  old.ts -> new.ts\nM  modified.ts\n M unstaged.ts\n',
      stderr: ''
    });
    const result = await execute({}, mockCtx);
    expect(result.isError).toBe(false);
    // Parser: staged = entries where code != '??' and not starting with space (branch line already skipped)
    // 'R  old.ts -> new.ts' -> staged
    // 'M  modified.ts' -> staged
    // ' M unstaged.ts' (code starts with space) -> unstaged
    expect(result.details.staged).toHaveLength(2);
    expect(result.details.staged).toContain('R  old.ts -> new.ts');
    expect(result.details.staged).toContain('M  modified.ts');
    expect(result.details.unstaged).toEqual([' M unstaged.ts']);
    expect(result.details.untracked).toEqual([]);
  });

});
