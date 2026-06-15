import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execute } from '../capabilities/dependency_tree';

const __filename = fileURLToPath(import.meta.url);

function debugResult(result: any) {
  if (result.isError) {
    // eslint-disable-next-line no-console
    console.error('CAP ERROR:', result.details, result.content);
  }
}

describe('codebase.dependency_tree', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tmpDir = await fs.mkdtemp('dep-tree-test-');
    process.chdir(tmpDir);
    tmpDir = process.cwd(); // ensure absolute path
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    // cleanup
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('basic single import', async () => {
    // File A: a.ts imports { foo } from './b'
    // File B: b.ts exports const foo = 1;
    await fs.writeFile('a.ts', `import { foo } from './b';\nexport const a = 2;`);
    await fs.writeFile('b.ts', `export const foo = 1;`);

    const result = await execute({ files: ['a.ts', 'b.ts'] }, { cwd: tmpDir } as any);
    expect(result.isError).toBe(false);
    const details = result.details as any;

    // nodes count 2
    expect(details.nodes.length).toBe(2);
    // edges: a.ts -> b.ts
    const edge = details.edges.find(e => e.from.endsWith('a.ts') && e.to.endsWith('b.ts'));
    expect(edge).toBeDefined();
    expect(edge?.symbols).toContain('foo');
    // cycles none
    expect(details.cycles.length).toBe(0);
    // summary
    expect(details.summary.totalFiles).toBe(2);
    expect(details.summary.totalEdges).toBe(1);
    expect(details.summary.cycleCount).toBe(0);
  });

  it('detects simple cycle', async () => {
    // a.ts imports from b
    // b.ts imports from c
    // c.ts imports from a
    await fs.writeFile('a.ts', `import x from './b';`);
    await fs.writeFile('b.ts', `import y from './c';`);
    await fs.writeFile('c.ts', `import z from './a';`);

    const result = await execute({ files: ['a.ts', 'b.ts', 'c.ts'] }, { cwd: tmpDir } as any);
    expect(result.isError).toBe(false);
    const details = result.details as any;

    expect(details.cycles.length).toBeGreaterThan(0);
    // cycle should contain all three
    const hasCycle = details.cycles.some((c: string[]) => c.length === 4 && c.includes('a.ts') && c.includes('b.ts') && c.includes('c.ts'));
    expect(hasCycle).toBe(true);
    expect(details.summary.cycleCount).toBeGreaterThan(0);
  });

  it('handles re-exports and wildcard', async () => {
    // a.ts: export { bar } from './b'
    // b.ts: export { foo } from './c'
    // c.ts: export const foo = 1;
    await fs.writeFile('a.ts', `export { bar } from './b';`);
    await fs.writeFile('b.ts', `export { foo } from './c';`);
    await fs.writeFile('c.ts', `export const foo = 1; export const bar = 2;`);

    const result = await execute({ files: ['a.ts', 'b.ts', 'c.ts'] }, { cwd: tmpDir } as any);
    expect(result.isError).toBe(false);
    const details = result.details as any;

    // Edges: b->c (from re-export), a->b (from re-export)
    const bToC = details.edges.find(e => e.from.endsWith('b.ts') && e.to.endsWith('c.ts'));
    expect(bToC).toBeDefined();
    const aToB = details.edges.find(e => e.from.endsWith('a.ts') && e.to.endsWith('b.ts'));
    expect(aToB).toBeDefined();
  });

  it('includes default and namespace imports', async () => {
    // a.ts: import React from 'react'; import * as utils from './b';
    // b.ts: export function helper() {}
    // We'll skip 'react' as external, but './b' should be resolved
    await fs.writeFile('a.ts', `import React from 'react';\nimport * as utils from './b';`);
    await fs.writeFile('b.ts', `export function helper() {}`);

    const result = await execute({ files: ['a.ts', 'b.ts'] }, { cwd: tmpDir } as any);
    expect(result.isError).toBe(false);
    const details = result.details as any;

    // a.ts imports from b.ts via namespace '*'
    const edge = details.edges.find(e => e.from.endsWith('a.ts') && e.to.endsWith('b.ts'));
    expect(edge).toBeDefined();
    expect(edge?.symbols).toContain('*');
  });

  it('gracefully handles missing dependency file', async () => {
    // a.ts imports from non-existent file
    await fs.writeFile('a.ts', `import { foo } from './missing';`);

    const result = await execute({ files: ['a.ts'] }, { cwd: tmpDir } as any);
    // Since missing file is not in the file list, it should not create edge, but no error
    expect(result.isError).toBe(false);
    const details = result.details as any;
    expect(details.nodes.length).toBe(1);
    expect(details.edges.length).toBe(0);
  });

  it('correctly collects exports and imports per node', async () => {
    await fs.writeFile('a.ts', `import { x } from './b';\nexport const a = 1;\n`);
    await fs.writeFile('b.ts', `export const x = 2;\nexport const y = 3;\n`);

    const result = await execute({ files: ['a.ts', 'b.ts'] }, { cwd: tmpDir } as any);
    expect(result.isError).toBe(false);
    const details = result.details as any;

    const nodeA = details.nodes.find(n => n.file.endsWith('a.ts'));
    const nodeB = details.nodes.find(n => n.file.endsWith('b.ts'));
    expect(nodeA).toBeDefined();
    expect(nodeB).toBeDefined();

    // a.ts exports ['a']; imports from b.ts
    expect(nodeA?.exports).toContain('a');
    expect(nodeA?.imports).toContain('b.ts');

    // b.ts exports ['x','y']; no imports
    expect(nodeB?.exports).toHaveLength(2);
    expect(nodeB?.exports).toContain('x');
    expect(nodeB?.exports).toContain('y');
    expect(nodeB?.imports).toHaveLength(0);
  });
});
