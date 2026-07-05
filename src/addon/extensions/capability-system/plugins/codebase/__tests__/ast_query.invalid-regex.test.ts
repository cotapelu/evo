import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, unlink } from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as astQueryModule from '../capabilities/ast_query.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function writeTempFile(content: string): Promise<string> {
  const dir = await mkdtemp(path.join(__dirname, 'temp-'));
  const file = path.join(dir, 'test.ts');
  await writeFile(file, content, 'utf-8');
  return file;
}

describe('codebase.ast_query invalid regex', () => {
  it('handles invalid regex pattern', async () => {
    const code = `function foo() {}`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    try {
      const result = await astQueryModule.execute(
        { file: path.basename(file), query: { kind: 'function', name: 'f*[' } },
        ctx as any
      );
      expect(result.isError).toBe(false);
      expect(result.details.matches).toHaveLength(0);
    } finally {
      await unlink(file);
    }
  });
});
