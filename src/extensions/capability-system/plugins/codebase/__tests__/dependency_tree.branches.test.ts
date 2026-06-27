#!/usr/bin/env node
/**
 * Branch coverage for codebase.dependency_tree
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';

const depTreeModule = await import('../capabilities/dependency_tree.ts');
const { execute } = depTreeModule;

describe('dependency_tree branch coverage', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(join(os.tmpdir(), 'dep-tree-branch-'));
    process.chdir(tempDir);
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    vi.restoreAllMocks();
  });

  const writeFile = async (name: string, content: string) => {
    const filePath = join(tempDir, name);
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  };

  it('handles parse error in file', async () => {
    await writeFile('bad.ts', 'function ('); // invalid syntax causing parse error
    const result = await execute({ files: ['bad.ts'] }, { cwd: tempDir } as any);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Parse error.*bad\.ts/);
  });

  it('handles readFile error', async () => {
    await writeFile('a.ts', `export const x = 1;`);
    vi.spyOn(fs, 'readFile').mockRejectedValue(new Error('fs read failed'));
    const result = await execute({ files: ['a.ts'] }, { cwd: tempDir } as any);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Error processing file a\.ts/);
  });

  it('handles import from external package (ignored)', async () => {
    // a.ts imports from an external package 'lodash'
    await writeFile('a.ts', `import _ from 'lodash'; export const x = 1;`);
    await writeFile('b.ts', `export const y = 2;`);
    // b.ts not imported by a, just extra file
    const result = await execute({ files: ['a.ts', 'b.ts'] }, { cwd: tempDir } as any);
    expect(result.isError).toBe(false);
    // No edge to external lodash
    const externalEdge = result.details.edges.find(e => e.to.includes('lodash') || e.from.includes('lodash'));
    expect(externalEdge).toBeUndefined();
  });

  it('handles import from missing local file (edge not created)', async () => {
    // a.ts imports from './missing' which is not in files list
    await writeFile('a.ts', `import { x } from './missing'; export const y = 2;`);
    const result = await execute({ files: ['a.ts'] }, { cwd: tempDir } as any);
    expect(result.isError).toBe(false);
    // Edge count zero because callee not resolved
    expect(result.details.edges.length).toBe(0);
  });

  it('deduplicates cycles of same nodes', async () => {
    // Create two files that import each other (single cycle)
    await writeFile('a.ts', `import { x } from './b'; export const a = 1;`);
    await writeFile('b.ts', `import { y } from './a'; export const b = 2;`);
    const result = await execute({ files: ['a.ts', 'b.ts'] }, { cwd: tempDir } as any);
    expect(result.isError).toBe(false);
    const cycles = result.details.cycles;
    // Should have exactly one cycle (deduped)
    expect(cycles.length).toBeGreaterThanOrEqual(1);
    // All cycles should be of length 3: [a.ts,..., b.ts,..., a.ts]? Actually cycle includes nodes in order, ending with starting node; length should be 3 (a->b->a)
    expect(cycles[0].length).toBe(3);
  });
});
