#!/usr/bin/env node
/**
 * Git Status Additional Edge Case Tests
 * Targeted to increase branch coverage.
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

  it('should handle branch-only line with no file changes', async () => {
    const mockCtx = createMockCtx('/test', { code: 0, stdout: '## main\n', stderr: '' });
    const result = await execute({}, mockCtx);
    expect(result.isError).toBe(false);
    expect(result.details.branch).toBe('main');
    expect(result.details.staged).toEqual([]);
    expect(result.details.unstaged).toEqual([]);
    expect(result.details.untracked).toEqual([]);
  });

  it('should handle only untracked files, no branch line', async () => {
    const mockCtx = createMockCtx('/test', { code: 0, stdout: '?? file1.ts\n?? file2.ts\n', stderr: '' });
    const result = await execute({}, mockCtx);
    expect(result.isError).toBe(false);
    expect(result.details.branch).toBe('(unknown)');
    expect(result.details.staged).toEqual([]);
    expect(result.details.unstaged).toEqual([]);
    expect(result.details.untracked).toEqual(['file1.ts', 'file2.ts']);
  });

  it('should handle mixed staged (renamed and modified', async () => {
    const mockCtx = createMockCtx('/test', {
      code: 0,
      stdout: 'R  old.ts -> new.ts\nM  modified.ts\n',
      stderr: ''
    });
    const result = await execute({}, mockCtx);
    expect(result.isError).toBe(false);
    expect(result.details.staged).toContain('R  old.ts -> new.ts');
      expect(result.details.staged).toHaveLength(2);
  });

});
