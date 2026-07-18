import { describe, it, expect } from 'vitest';
import { mkdir, writeFile, unlink } from 'fs/promises';
import * as path from 'path';
import analyzeModule from '../capabilities/analyze.js';

async function writeTempFile(content: string, ext = 'ts'): Promise<string> {
  const timestamp = Date.now();
  const dir = path.join(__dirname, 'temp');
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `analyze-more-${timestamp}.${ext}`);
  await writeFile(file, content, 'utf-8');
  return file;
}

describe('analyze additional branch coverage', () => {
  afterEach(async () => {
    // No cleanup needed; temp files will be overwritten
  });

  it('covers import type, export destructuring, aliases, and various forms', async () => {
    const code = `
import type { SomeType } from "mod-type";
import { foo } from "mod-named";
import { bar as barAlias } from "mod-alias";
import * as ns from "mod-ns";
export { foo, bar };
export { baz as qux } from "mod-reexport";
export const { a, b } = obj;
const obj = { a: 1, b: 2 };
export default function defaultFunc() {}
export default class DefaultClass {}
export type MyType = string;
export interface MyInterface {}
export enum MyEnum { A, B }
    `;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await analyzeModule.execute({ file: path.basename(file) }, ctx as any);
    expect(result.isError).toBe(false);
    const imports = result.details.imports;
    expect(imports.length).toBeGreaterThanOrEqual(4);
    // type import
    const typeImport = imports.find(imp => imp.moduleSpecifier === 'mod-type');
    expect(typeImport).toBeDefined();
    expect(typeImport.typeOnly).toBe(true);
    // namespace import
    const nsImport = imports.find(imp => imp.importClause === 'ns');
    expect(nsImport).toBeDefined();
    // named exports
    const namedExports = result.details.exports.filter(exp => exp.type === 'named' && (exp.name === 'foo' || exp.name === 'bar'));
    expect(namedExports.length).toBe(2);
    // alias export
    const aliasExport = result.details.exports.find(exp => exp.name === 'qux');
    expect(aliasExport).toBeDefined();
  });
});
