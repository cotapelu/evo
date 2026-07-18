import { describe, it, expect } from 'vitest';
import { mkdir, writeFile, unlink } from 'fs/promises';
import * as path from 'path';
import astQueryModule from '../capabilities/ast_query.js';

async function writeTempFile(content: string, ext = 'ts'): Promise<string> {
  const timestamp = Date.now();
  const dir = path.join(__dirname, 'temp');
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `ast_query-branch-${timestamp}.${ext}`);
  await writeFile(file, content, 'utf-8');
  return file;
}

describe('ast_query branch coverage additional', () => {
  it('covers parentMatches with function container', async () => {
    const code = `
function outer() {
  function inner() {}
}
    `;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await astQueryModule.execute({
      file: path.basename(file),
      query: { kind: 'function', parent: 'outer' }
    }, ctx as any);
    expect(result.isError).toBe(false);
    const matches = result.details.matches;
    expect(matches.length).toBe(1);
    expect(matches[0].name).toBe('inner');
    expect(matches[0].parent).toBe('outer');
    await unlink(file);
  });

  it('covers handleFunction MethodDefinition with computed property name (value)', async () => {
    const code = `
class C {
  ['myMethod']() {}
}
    `;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await astQueryModule.execute({
      file: path.basename(file),
      query: { kind: 'function' }
    }, ctx as any);
    expect(result.isError).toBe(false);
    const methodMatches = result.details.matches.filter(m => m.kind === 'function' && m.name === 'myMethod');
    expect(methodMatches.length).toBe(1);
    await unlink(file);
  });
});
