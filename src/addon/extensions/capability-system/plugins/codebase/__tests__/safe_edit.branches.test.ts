import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import safeEditModule from '../capabilities/safe_edit.js';

describe('safe_edit branch coverage', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'safe-edit-branch-'));
  });

  afterEach(async () => {
    try { await rm(tempDir, { recursive: true, force: true }); } catch {}
  });

  function createMockCtx() {
    return {
      cwd: tempDir,
      exec: async (cmd: string, args: string[]) => {
        if (cmd === 'npx' && args[0] === 'tsc') return { code: 0, stdout: '', stderr: '' };
        if (cmd === 'npx' && args[0] === 'eslint') return { code: 0, stdout: '', stderr: '' };
        if (cmd === 'npx' && args[0] === 'prettier') return { code: 0, stdout: '', stderr: '' };
        return { code: 0, stdout: '', stderr: '' };
      },
    };
  }

  it('rejects when newCode missing for replace/insert (validation failure)', async () => {
    const ctx = createMockCtx();
    const params = {
      operations: [{ file: 'a.ts', editType: 'replace' as const, range: { start: 0, end: 1 } }], // no newCode
      format: false,
      fixImports: false,
    };

    const result = await safeEditModule.execute(params, ctx as any);
    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].success).toBe(false);
    expect(result.results[0].error).toContain('newCode is required');
  });

  it('rejects when tsc returns non-zero non-2 exit code', async () => {
    const file = join(tempDir, 'a.ts');
    await writeFile(file, 'code', 'utf-8');

    const ctx = createMockCtx();
    ctx.exec = async (cmd: string, args: string[]) => {
      if (cmd === 'npx' && args[0] === 'tsc') {
        return { code: 1, stdout: '', stderr: 'TypeScript error' };
      }
      if (cmd === 'npx' && args[0] === 'eslint') {
        return { code: 0, stdout: '', stderr: '' };
      }
      if (cmd === 'npx' && args[0] === 'prettier') {
        return { code: 0, stdout: '', stderr: '' };
      }
      return { code: 0, stdout: '', stderr: '' };
    };

    const params = {
      operations: [{ file: 'a.ts', editType: 'replace' as const, range: { start: 0, end: 1 }, newCode: 'changed' }],
      format: false,
      fixImports: false,
    };

    const result = await safeEditModule.execute(params, ctx as any);
    expect(result.success).toBe(false);
    expect(result.results[0].success).toBe(false);
    expect(result.results[0].error).toContain('TypeScript check failed');
    expect(result.results[0].backupRestored).toBe(true);
  });

  it('rejects operations with path traversal attempt (Round 232 — line ~204 catch branch)', async () => {
    const ctx = createMockCtx();
    const params = {
      operations: [
        // '../outsideSafe.ts' resolves outside cwd → resolveSecurePath throws → branch falls into the catch block.
        { file: '../outsideSafe.ts', editType: 'replace' as const, range: { start: 0, end: 1 }, newCode: 'hacked' },
      ],
      format: false,
      fixImports: false,
    };

    const result = await safeEditModule.execute(params, ctx as any);
    expect(result.success).toBe(false);
    expect(result.results[0].success).toBe(false);
    expect(result.results[0].error).toContain('Access denied');
  });
});

