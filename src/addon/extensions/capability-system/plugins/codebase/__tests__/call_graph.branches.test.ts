#!/usr/bin/env node
/**
 * Additional branch coverage for codebase.call_graph
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import call_graph capability
const callGraphModule = await import("../capabilities/call_graph.ts");

describe('codebase.call_graph branch coverage', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp('callgraph-branch-');
  });

  afterEach(async () => {
    try { await rm(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it('records call inside class method (MethodDefinition)', async () => {
    const code = `
class Service {
  async start() {
    initialize();
  }
}
function initialize() {}
    `;
    const file = join(tmpDir, 'service.ts');
    await writeFile(file, code, 'utf8');

    const ctx = { cwd: tmpDir };
    const result = await callGraphModule.execute({ file: 'service.ts', query: { includeCrossFile: false } }, ctx as any);

    expect(result.isError).toBe(false);
    const nodes = result.details.result.nodes;
    const edges = result.details.result.edges;

    // Should have two functions: start and initialize
    expect(nodes.some(n => n.name === 'start')).toBe(true);
    expect(nodes.some(n => n.name === 'initialize')).toBe(true);
    // Edge: start -> initialize
    expect(edges.some(e => e.from.name === 'start' && e.to.name === 'initialize')).toBe(true);
  });

  it('ignores top-level call outside any function', async () => {
    // Call before any function declaration ensures funcStack is empty
    const code = `foo(); function foo() {}`;
    const file = join(tmpDir, 'toplevel.ts');
    await writeFile(file, code, 'utf8');

    const ctx = { cwd: tmpDir };
    const result = await callGraphModule.execute({ file: 'toplevel.ts', query: { includeCrossFile: false } }, ctx as any);

    expect(result.isError).toBe(false);
    const nodes = result.details.result.nodes;
    const edges = result.details.result.edges;

    // foo should be a node
    expect(nodes.some(n => n.name === 'foo')).toBe(true);
    // No edge because call not inside a function
    expect(edges.length).toBe(0);
  });

  it('ignores call with non-Identifier callee (MemberExpression)', async () => {
    const code = `
function caller() {
  obj.method();
}
const obj = { method() {} };
    `;
    const file = join(tmpDir, 'member.ts');
    await writeFile(file, code, 'utf8');

    const ctx = { cwd: tmpDir };
    const result = await callGraphModule.execute({ file: 'member.ts', query: { includeCrossFile: false } }, ctx as any);

    expect(result.isError).toBe(false);
    const nodes = result.details.result.nodes;
    const edges = result.details.result.edges;

    // Both caller and method should be nodes? method is function expression but may not be collected because it's not a declaration (no name). The function expression as object property is not a FunctionDeclaration/Expression/MethodDefinition? Actually MethodDefinition in a class; but this is an object literal property with function value; node.type for that property is 'Property' not handled. So only caller should be node.
    expect(nodes.some(n => n.name === 'caller')).toBe(true);
    // method not collected => no edge
    const hasEdge = edges.some(e => e.from.name === 'caller' && e.to.name === 'method');
    expect(hasEdge).toBe(false);
  });

  it('records call to function defined in same file even when not in imports (local call)', async () => {
    const code = `
export function exportedHelper() {}
function internalHelper() {}
function main() {
  exportedHelper();
  internalHelper();
}
    `;
    const file = join(tmpDir, 'local.ts');
    await writeFile(file, code, 'utf8');

    const ctx = { cwd: tmpDir };
    const result = await callGraphModule.execute({ file: 'local.ts', query: { includeCrossFile: false } }, ctx as any);

    expect(result.isError).toBe(false);
    const nodes = result.details.result.nodes;
    const edges = result.details.result.edges;

    expect(nodes.some(n => n.name === 'main')).toBe(true);
    expect(nodes.some(n => n.name === 'exportedHelper')).toBe(true);
    expect(nodes.some(n => n.name === 'internalHelper')).toBe(true);
    // Edges: main->exportedHelper, main->internalHelper
    expect(edges.some(e => e.from.name === 'main' && e.to.name === 'exportedHelper')).toBe(true);
    expect(edges.some(e => e.from.name === 'main' && e.to.name === 'internalHelper')).toBe(true);
  });
});
