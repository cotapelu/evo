import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { execute } from '../capabilities/complexity.js';

describe('codebase.complexity branch coverage (Round 230)', () => {
  it('handles nested CallExpression callee and non-Identifier arguments', async () => {
    // nested call `foo()()` exercises the CallExpression callee branch (line 91-99)
    // arg `(1 + 2)` is a BinaryExpression, exercising the non-Identifier argument branch
    const tmpdir = await mkdtemp('complexity-branch-');
    try {
      const fileRel = 'nested.ts';
      const content = `
export const x = foo()()(1 + 2);
`;
      await writeFile(join(tmpdir, fileRel), content, 'utf8');
      const result = await execute({ file: fileRel }, { cwd: tmpdir });
      expect(result.isError).toBe(false);
      const halstead = (result.details as any).halstead;
      expect(halstead).toBeDefined();
      expect(halstead.volume).toBeGreaterThan(0);
    } finally {
      await rm(tmpdir, { recursive: true, force: true });
    }
  });
});
