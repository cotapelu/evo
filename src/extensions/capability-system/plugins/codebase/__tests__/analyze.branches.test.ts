#!/usr/bin/env node
/**
 * Branch coverage for codebase.analyze
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';

// Mock fs to control readFile/access
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      readFile: vi.fn(),
      access: vi.fn(),
    },
  };
});

const { execute } = await import('../capabilities/analyze.ts');

describe('analyze branch coverage', () => {
  let tempDir: string;

  beforeEach(async () => {
    const fs = await import('fs/promises');
    const os = await import('os');
    tempDir = await fs.mkdtemp(join(os.tmpdir(), 'piclaw-analyze-branches-'));
    // Set up fs mocks: access resolves, readFile will be set per test
    const { access } = await import('fs').then(m => m.promises);
    vi.mocked(access).mockResolvedValue(undefined);
  });

  afterEach(async () => {
    const fs = await import('fs/promises');
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  const writeFile = async (name: string, content: string) => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const filePath = path.join(tempDir, name);
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  };

  it('handles readFile error', async () => {
    const { readFile } = await import('fs').then(m => m.promises);
    vi.mocked(readFile).mockRejectedValue(new Error('read fail'));

    await writeFile('err.ts', 'const x = 1;');
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'err.ts' }, ctx);
    expect(result.isError).toBe(true);
    expect(result.details?.error).toContain('read fail');
  });

  it('handles readFile throwing non-Error', async () => {
    const { readFile } = await import('fs').then(m => m.promises);
    vi.mocked(readFile).mockRejectedValue('unexpected error');

    await writeFile('err2.ts', 'const y = 2;');
    const ctx = { cwd: tempDir } as any;
    const result = await execute({ file: 'err2.ts' }, ctx);
    expect(result.isError).toBe(true);
    expect(result.details?.error).toBe('unexpected error');
  });
});
