#!/usr/bin/env node
/**
 * Branch coverage for codebase.ast_query
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';

const astQueryModule = await import('../capabilities/ast_query.ts');
const { execute } = astQueryModule;

describe('ast_query branch coverage', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(os.tmpdir(), 'piclaw-ast-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  const writeFile = async (name: string, content: string) => {
    const filePath = join(tempDir, name);
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  };

  it('handles parse error in AST', async () => {
    await writeFile('bad.ts', 'class'); // invalid syntax
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'bad.ts', query: { kind: 'class' } }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Parse error/);
  });
});
