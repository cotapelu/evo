#!/usr/bin/env node
/**
 * Additional branch coverage tests for codebase.ast_query
 */

import { describe, it, expect } from "vitest";
import { mkdir, writeFile, unlink } from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to create temp files
async function writeTempFile(content: string, ext = "ts"): Promise<string> {
  const timestamp = Date.now();
  const dir = path.join(__dirname, "temp");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `branch-${timestamp}.${ext}`);
  await writeFile(file, content, "utf-8");
  return file;
}

// Import ast_query capability
const astQueryModule = await import("../capabilities/ast_query.ts");

describe("codebase.ast_query branch coverage", () => {
  afterEach(async () => {
    // Cleanup not strictly needed; temp files overwritten with timestamp
  });

  describe("handleClass - ClassExpression", () => {
    it('should find class expression (anonymous)', async () => {
      const code = `const C = class { method() {} };`;
      const file = await writeTempFile(code);
      try {
        const ctx = { cwd: path.dirname(file) };
        const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: "class" } }, ctx as any);
        expect(result.isError).toBe(false);
        const classMatch = result.details.matches.find((m: any) => m.kind === "class");
        expect(classMatch).toBeDefined();
        expect(classMatch?.name).toBe("<anonymous>");
      } finally { await unlink(file).catch(() => {}); }
    });
  });

  describe("parent filter - method in class", () => {
    it('should match method inside class via parent filter', async () => {
      const code = `class Container { method() {} }`;
      const file = await writeTempFile(code);
      try {
        const ctx = { cwd: path.dirname(file) };
        const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: "function", parent: "Container" } }, ctx as any);
        expect(result.isError).toBe(false);
        expect(result.details.matches.length).toBe(1);
        expect(result.details.matches[0].parent).toBe("Container");
      } finally { await unlink(file).catch(() => {}); }
    });
  });

  describe("handleExport - various forms", () => {
    it('should handle export default expression (name=default)', async () => {
      const code = `export default 123;`;
      const file = await writeTempFile(code);
      try {
        const ctx = { cwd: path.dirname(file) };
        const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: "export" } }, ctx as any);
        expect(result.isError).toBe(false);
        const match = result.details.matches.find((m: any) => m.name === "default");
        expect(match).toBeDefined();
      } finally { await unlink(file).catch(() => {}); }
    });

    it('should handle export default function declaration', async () => {
      const code = `export default function foo() {}`;
      const file = await writeTempFile(code);
      try {
        const ctx = { cwd: path.dirname(file) };
        const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: "export" } }, ctx as any);
        expect(result.isError).toBe(false);
        const match = result.details.matches.find((m: any) => m.name === "foo");
        expect(match).toBeDefined();
      } finally { await unlink(file).catch(() => {}); }
    });

    it('should handle export variable declaration with multiple declarators as single match', async () => {
      const code = `export const a = 1, b = 2;`;
      const file = await writeTempFile(code);
      try {
        const ctx = { cwd: path.dirname(file) };
        const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: "export" } }, ctx as any);
        expect(result.isError).toBe(false);
        // This produces one match with name "a, b"
        const match = result.details.matches.find((m: any) => m.name === "a, b");
        expect(match).toBeDefined();
      } finally { await unlink(file).catch(() => {}); }
    });

    it('should handle export {} empty', async () => {
      const code = `export {};`;
      const file = await writeTempFile(code);
      try {
        const ctx = { cwd: path.dirname(file) };
        const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: "export" } }, ctx as any);
        expect(result.isError).toBe(false);
        expect(result.details.matches.length).toBe(1);
        expect(result.details.matches[0].name).toBe("<export>");
      } finally { await unlink(file).catch(() => {}); }
    });
  });

  describe("limit handling", () => {
    it('should respect limit of zero (yield no matches)', async () => {
      const code = `function a() {} function b() {}`;
      const file = await writeTempFile(code);
      try {
        const ctx = { cwd: path.dirname(file) };
        const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: "function", limit: 0 } }, ctx as any);
        expect(result.isError).toBe(false);
        expect(result.details.matches).toHaveLength(0);
      } finally { await unlink(file).catch(() => {}); }
    });

    it('should stop collecting after limit reached', async () => {
      const code = Array.from({ length: 100 }, (_, i) => `function fn${i}() {}`).join('\n');
      const file = await writeTempFile(code);
      try {
        const ctx = { cwd: path.dirname(file) };
        const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: "function", limit: 10 } }, ctx as any);
        expect(result.isError).toBe(false);
        expect(result.details.matches).toHaveLength(10);
      } finally { await unlink(file).catch(() => {}); }
    });
  });

  describe("name filter - no match case", () => {
    it('should return empty matches when name pattern matches none', async () => {
      const code = `function foo() {} function bar() {}`;
      const file = await writeTempFile(code);
      try {
        const ctx = { cwd: path.dirname(file) };
        const result = await astQueryModule.execute({ file: path.basename(file), query: { kind: "function", name: "nonexistent" } }, ctx as any);
        expect(result.isError).toBe(false);
        expect(result.details.matches).toHaveLength(0);
      } finally { await unlink(file).catch(() => {}); }
    });
  });

});
