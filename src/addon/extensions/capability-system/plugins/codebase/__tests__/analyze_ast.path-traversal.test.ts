#!/usr/bin/env node
/**
 * Additional branch coverage for codebase.analyze_ast - path traversal error
 */

import { describe, it, expect } from 'vitest';
import { execute } from '../capabilities/analyze_ast.ts';

describe('codebase.analyze_ast path traversal', () => {
  it('rejects path traversal attempts', async () => {
    const ctx = { cwd: '/safe/dir' };
    // Attempt to access parent directory using '..'
    const result = await execute({ file: '../../../etc/passwd' }, ctx as any);
    expect(result.isError).toBe(true);
    expect(result.details?.error).toBe('path_traversal');
    expect(result.content[0].text).toContain('Access denied');
  });
});
