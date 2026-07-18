import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { execute } from '../capabilities/dependency_tree.js';

describe('codebase.dependency_tree branch coverage (Round 231)', () => {
  const tempDir = join(__dirname, 'temp');

  beforeEach(async () => {
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(join(tempDir, '171.ts'), { force: true });
      await rm(join(tempDir, '172.ts'), { force: true });
      await rm(join(tempDir, '173.ts'), { force: true });
    } catch { /* ignore */ }
  });

  async function writeFileAt(rel: string, content: string) {
    await writeFile(join(tempDir, rel), content, 'utf8');
  }

  it('covers wildcard re-export branch (no specifiers on ExportNamedDeclaration)', async () => {
    await writeFileAt('171.ts', 'export const x = 1;\n');
    await writeFileAt('172.ts', 'export * from "./171";\n');
    const res = await execute({ files: ['171.ts', '172.ts'] }, { cwd: tempDir });
    expect(res.isError).toBe(false);
    const details = res.details as any;
    const ids: string[] = (details.nodes ?? []).map((n: any) => n.id);
    expect(ids).toContain('171.ts');
    expect(ids).toContain('172.ts');
    // Verify the wildcard hit: the `else` branch in processReimport pushes '*'
    const edges = details.edges as Array<{ from: string; to: string; symbols: string[] }>;
    const we = edges.find((e) => e.from === '172.ts' && e.to === '171.ts');
    expect(we).toBeDefined();
    expect(we!.symbols).toContain('*');
  });

  it('covers empty-params.files branch', async () => {
    const res = await execute({ files: [] as unknown as string[] }, { cwd: tempDir });
    expect(res.isError).toBe(true);
    expect((res.details as any).error).toBe('files required');
  });

  it('covers parse-error catch branch via non-existent file', async () => {
    const res = await execute(
      { files: ['./this-file-does-not-exist-' + Date.now() + '.ts'] },
      { cwd: tempDir }
    );
    expect(res.isError).toBe(true);
    expect(typeof (res.details as any).error).toBe('string');
  });
});
