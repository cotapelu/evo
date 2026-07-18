import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import safeEditModule from '../capabilities/safe_edit.js';

describe('safe_edit additional branch coverage', () => {
  it('covers replace operation branch', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'safe-edit-replace-'));
    const file = join(tempDir, 'a.ts');
    await writeFile(file, 'old content', 'utf-8');
    const ctx = {
      cwd: tempDir,
      exec: async (cmd: string, args: string[]) => {
        if (cmd === 'npx' && args[0] === 'tsc') return { code: 0, stdout: '', stderr: '' };
        if (cmd === 'npx' && args[0] === 'eslint') return { code: 0, stdout: '', stderr: '' };
        if (cmd === 'npx' && args[0] === 'prettier') return { code: 0, stdout: '', stderr: '' };
        return { code: 0 };
      }
    };
    const params = {
      operations: [{ file: 'a.ts', editType: 'replace' as const, range: { start: 0, end: 1 }, newCode: 'new content' }],
      format: false,
      fixImports: false,
    };
    const result = await safeEditModule.execute(params, ctx as any);
    expect(result.success).toBe(true);
    expect(result.results[0].success).toBe(true);
    const updated = await readFile(file, 'utf-8');
    expect(updated).toBe('new content');
    await rm(tempDir, { recursive: true, force: true });
  });

  it('covers format true branch', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'safe-edit-format-'));
    const file = join(tempDir, 'b.ts');
    await writeFile(file, 'code', 'utf-8');
    const ctx = {
      cwd: tempDir,
      exec: async (cmd: string, args: string[]) => {
        if (cmd === 'npx' && args[0] === 'tsc') return { code: 0, stdout: '', stderr: '' };
        if (cmd === 'npx' && args[0] === 'eslint') return { code: 0, stdout: '', stderr: '' };
        if (cmd === 'npx' && args[0] === 'prettier') return { code: 0, stdout: '', stderr: '' };
        return { code: 0 };
      }
    };
    const params = {
      operations: [{ file: 'b.ts', editType: 'replace' as const, range: { start: 0, end: 1 }, newCode: 'formatted' }],
      format: true,
      fixImports: false,
    };
    const result = await safeEditModule.execute(params, ctx as any);
    expect(result.success).toBe(true);
    const content = await readFile(file, 'utf-8');
    expect(content).toBe('formatted');
    await rm(tempDir, { recursive: true, force: true });
  });
});
