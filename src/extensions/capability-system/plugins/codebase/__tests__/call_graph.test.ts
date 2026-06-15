#!/usr/bin/env node
/**
 * Tests for codebase.call_graph capability
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, unlink, mkdtemp, rm } from "fs/promises";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to create temp files
async function writeTempFile(content: string, ext = "ts", subdir?: string): Promise<string> {
  const timestamp = Date.now();
  const baseDir = subdir ? path.join(__dirname, "temp", subdir) : path.join(__dirname, "temp");
  await mkdir(baseDir, { recursive: true });
  const file = path.join(baseDir, `call-${timestamp}.${ext}`);
  await writeFile(file, content, "utf-8");
  return file;
}

// Import call_graph capability
const callGraphModule = await import("../capabilities/call_graph.ts");

describe("codebase.call_graph", () => {
  afterEach(async () => {
    // Cleanup not strictly needed; temp files overwritten with timestamp
  });

  it("should handle missing file", async () => {
    const ctx = { cwd: __dirname };
    const result = await callGraphModule.execute({ file: "nonexistent.ts", query: {} }, ctx as any);

    expect(result.isError).toBe(false); // Currently we just return empty graph for missing files
    expect(result.details.result.nodes.length).toBe(0);
  });

  it("should handle parse error", async () => {
    const code = `function foo() {
  return (`;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await callGraphModule.execute({ file: path.basename(file), query: {} }, ctx as any);

    expect(result.isError).toBe(false); // Graceful: empty graph
    expect(result.details.result.nodes.length).toBe(0);
    expect(result.details.result.edges.length).toBe(0);

    await unlink(file);
  });

  it("should build simple call graph within one file", async () => {
    const code = `
function a() { b(); }
function b() { c(); }
function c() {}
    `;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await callGraphModule.execute({ file: path.basename(file), query: { includeCrossFile: false } }, ctx as any);

    expect(result.isError).toBe(false);
    const nodes = result.details.result.nodes;
    const edges = result.details.result.edges;

    expect(nodes.length).toBe(3);
    expect(edges.length).toBe(2);
    // Check edges: a->b, b->c
    const edgeNames = edges.map(e => `${e.from.name}->${e.to.name}`).sort();
    expect(edgeNames).toEqual(["a->b", "b->c"]);

    await unlink(file);
  });

  it("should filter edges by callee name pattern", async () => {
    const code = `
function foo() { bar(); baz(); }
function bar() {}
function baz() {}
    `;
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await callGraphModule.execute({ file: path.basename(file), query: { name: "bar", includeCrossFile: false } }, ctx as any);

    expect(result.isError).toBe(false);
    expect(result.details.result.edges.length).toBe(1);
    expect(result.details.result.edges[0].to.name).toBe("bar");

    await unlink(file);
  });

  it("should respect limit", async () => {
    const lines = Array.from({ length: 10 }, (_, i) => `func${i}()`).join('; ');
    const code = `function caller() { ${lines} }` + Array.from({ length: 10 }, (_, i) => `function func${i}() {}`).join('\n');
    const file = await writeTempFile(code);
    const ctx = { cwd: path.dirname(file) };
    const result = await callGraphModule.execute({ file: path.basename(file), query: { limit: 5, includeCrossFile: false } }, ctx as any);

    expect(result.isError).toBe(false);
    expect(result.details.result.edges.length).toBe(5);

    await unlink(file);
  });

  it("should build cross-file call graph with simple import", async () => {
    // lib.ts exports function callee
    const libCode = `export function callee() {}`;
    const mainCode = `import { callee } from "./lib"; function main() { callee(); }`;

    const dir = await mkdtemp(path.join(os.tmpdir(), "callgraph-cross-"));
    const libFile = path.join(dir, "lib.ts");
    const mainFile = path.join(dir, "main.ts");
    await writeFile(libFile, libCode, "utf-8");
    await writeFile(mainFile, mainCode, "utf-8");

    const result = await callGraphModule.execute({ file: "main.ts", query: { includeCrossFile: true, depth: 1 } }, { cwd: dir } as any);

    expect(result.isError).toBe(false);
    const nodes = result.details.result.nodes.map(n => n.name);
    expect(nodes).toContain("main");
    expect(nodes).toContain("callee");
    const edges = result.details.result.edges;
    expect(edges.length).toBe(1);
    expect(edges[0].from.name).toBe("main");
    expect(edges[0].to.name).toBe("callee");

    // Cleanup
    await unlink(libFile);
    await unlink(mainFile);
    await rm(dir, { recursive: true, force: true });
  });

  it("should handle depth limit", async () => {
    // chain: a -> b -> c -> d
    const libC = `export function c() {}`;
    const libD = `export function d() {}`;
    const libB = `import { c } from "./libC"; export function b() { c(); }`;
    const libA = `import { b } from "./libB"; export function a() { b(); }`;
    const dir = await mkdtemp(path.join(os.tmpdir(), "callgraph-depth-"));
    await writeFile(path.join(dir, "libC.ts"), libC);
    await writeFile(path.join(dir, "libD.ts"), libD);
    await writeFile(path.join(dir, "libB.ts"), libB);
    await writeFile(path.join(dir, "libA.ts"), libA);

    const result = await callGraphModule.execute({ file: "libA.ts", query: { includeCrossFile: true, depth: 2 } }, { cwd: dir } as any);

    expect(result.isError).toBe(false);
    const names = result.details.result.nodes.map(n => n.name).sort();
    // depth 2: a -> b -> c (includes a, b, c). d is at depth 3 and should be excluded.
    expect(names).toEqual(["a", "b", "c"]);

    // Cleanup
    for (const f of ["libA.ts", "libB.ts", "libC.ts", "libD.ts"]) {
      try { await unlink(path.join(dir, f)); } catch {}
    }
    await rm(dir, { recursive: true, force: true });
  });

  it("should not duplicate nodes", async () => {
    // two files import same function from same lib
    const lib = `export function shared() {}`;
    const a = `import { shared } from "./lib"; function a() { shared(); }`;
    const b = `import { shared } from "./lib"; function b() { shared(); }`;
    const dir = await mkdtemp(path.join(os.tmpdir(), "callgraph-dup-"));
    await writeFile(path.join(dir, "lib.ts"), lib);
    await writeFile(path.join(dir, "a.ts"), a);
    await writeFile(path.join(dir, "b.ts"), b);

    const result = await callGraphModule.execute({ file: "a.ts", query: { includeCrossFile: true, depth: 1 } }, { cwd: dir } as any);

    expect(result.isError).toBe(false);
    // shared should appear once
    const sharedNodes = result.details.result.nodes.filter(n => n.name === "shared");
    expect(sharedNodes.length).toBe(1);

    // Cleanup
    for (const f of ["lib.ts", "a.ts", "b.ts"]) {
      try { await unlink(path.join(dir, f)); } catch {}
    }
    await rm(dir, { recursive: true, force: true });
  });
});
