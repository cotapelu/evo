import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { execute } from '../capabilities/analyze_ast.ts';

describe('codebase.analyze_ast unknown extension coverage', () => {
  let tmpdir: string;

  beforeEach(async () => {
    tmpdir = await mkdtemp('analyze-unknown-');
  });

  afterEach(async () => {
    await rm(tmpdir, { recursive: true, force: true });
  });

  it('returns unknown language for unrecognized file extension', async () => {
    const file = join(tmpdir, 'file.unknown');
    await writeFile(file, 'const x = 1;', 'utf8');
    const ctx = { cwd: tmpdir };
    const result = await execute({ file: 'file.unknown' }, ctx as any);
    expect(result.isError).toBe(false);
    expect(result.details.language).toBe('unknown');
    expect(result.details.exists).toBe(true);
  });
});
