#!/usr/bin/env node
/**
 * codebase.dependency_tree capability
 *
 * Builds a module dependency graph for TypeScript/JavaScript files.
 * Detects cycles, computes per-file exports/imports, and provides reachable analysis from entry points.
 */

import { Type } from "typebox";
import { promises as fs } from "fs";
import { join, dirname, relative, resolve } from "path";
import { fileURLToPath } from "url";

interface ParserModule {
  parse: (source: string, options?: any) => any;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple AST walker
function walk(node: any, visitor: (n: any, parent?: any) => void, parent?: any) {
  if (!node || typeof node !== 'object') return;
  visitor(node, parent);
  for (const key in node) {
    if (node[key] && typeof node[key] === 'object') {
      if (Array.isArray(node[key])) {
        node[key].forEach((child: any) => walk(child, visitor, node));
      } else {
        walk(node[key], visitor, node);
      }
    }
  }
}

// Parse a file to extract imports and exports
interface FileModuleInfo {
  file: string;
  exports: string[];   // exported symbol names (including 'default' if present)
  imports: Map<string, string[]>; // source file path -> array of imported binding names
}

async function parseModule(filePath: string, source: string): Promise<FileModuleInfo> {
  // Dynamic import of parser
// @ts-ignore
  const parser = await import("@typescript-eslint/parser/dist/index.js") as ParserModule;
  const { parse } = parser;

  let ast;
  try {
    ast = parse(source, { sourceType: "module", ecmaVersion: "latest", ts: true, jsx: true });
  } catch (err: any) {
    throw new Error(`Parse error in ${filePath}: ${err.message}`);
  }

  const exports: string[] = [];
  const imports: Map<string, string[]> = new Map();

  walk(ast, (node: any) => {
    // Export declarations
    if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration) {
        // export const foo = ...; export function foo() ...; export class Foo ...
        if (node.declaration.type === 'VariableDeclaration') {
          const decls = node.declaration.declarations || [];
          decls.forEach((d: any) => {
            if (d.id && d.id.type === 'Identifier') {
              exports.push(d.id.name);
            }
          });
        } else if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id) {
          exports.push(node.declaration.id.name);
        } else if (node.declaration.type === 'ClassDeclaration' && node.declaration.id) {
          exports.push(node.declaration.id.name);
        }
      }
      if (node.specifiers) {
        // export { foo, bar } or export { foo as bar }
        node.specifiers.forEach((spec: any) => {
          if (spec.exported) {
            const name = spec.exported.type === 'Identifier' ? spec.exported.name : spec.exported.name;
            exports.push(name);
          }
        });
      }
      // export from 'module' (re-export)
      if (node.source) {
        const src = node.source.value;
        const importedSymbols: string[] = [];
        if (node.specifiers) {
          node.specifiers.forEach((spec: any) => {
            if (spec.local) {
              const name = spec.local.type === 'Identifier' ? spec.local.name : spec.local.name;
              importedSymbols.push(name);
            }
          });
        } else {
          // export * from 'module' or export { everything } from 'module'
          importedSymbols.push('*'); // wildcard re-export
        }
        imports.set(src, (imports.get(src) || []).concat(importedSymbols));
      }
    }
    else if (node.type === 'ExportDefaultDeclaration') {
      exports.push('default');
      // If it also has a source? Not possible; default export only.
    }
    else if (node.type === 'ExportAllDeclaration') {
      // export * from 'module'
      if (node.source) {
        const src = node.source.value;
        imports.set(src, (imports.get(src) || []).concat(['*']));
      }
    }
    // Import declarations
    else if (node.type === 'ImportDeclaration') {
      const src = node.source.value;
      const imported: string[] = [];
      if (node.specifiers) {
        node.specifiers.forEach((spec: any) => {
          if (spec.type === 'ImportSpecifier' || spec.type === 'ImportDefaultSpecifier' || spec.type === 'ImportNamespaceSpecifier') {
            if (spec.imported) {
              const name = spec.imported.type === 'Identifier' ? spec.imported.name : spec.imported.name;
              imported.push(name);
            } else if (spec.type === 'ImportDefaultSpecifier') {
              imported.push('default');
            } else if (spec.type === 'ImportNamespaceSpecifier') {
              imported.push('*');
            }
          }
        });
      }
      imports.set(src, (imports.get(src) || []).concat(imported));
    }
  });

  return { file: filePath, exports, imports };
}

// Resolve a module specifier to a file path within the provided set of files.
function resolveInAllFiles(specifier: string, referrer: string, allFiles: Set<string>): string | null {
  // Skip external packages (node_modules or non-relative)
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    return null;
  }
  const refDir = dirname(referrer);
  const base = resolve(refDir, specifier);
  const extensions = ['.ts', '.tsx', '.js', '.jsx', ''];
  for (const ext of extensions) {
    const candidate = base + ext;
    if (allFiles.has(candidate)) return candidate;
  }
  // If the specifier itself is an absolute path present in allFiles
  if (allFiles.has(specifier)) return specifier;
  // Also try resolving the specifier as is relative to cwd (if it's absolute)
  if (allFiles.has(resolve(specifier))) return resolve(specifier);
  return null;
}

// Build the dependency graph
interface NodeInfo {
  id: string;
  file: string;
  exports: Set<string>;
  imports: Map<string, string[]>; // resolved target file -> symbols
  incoming: Set<string>; // set of file IDs that depend on this
}

interface GraphResult {
  nodes: Array<{ id: string; file: string; exports: string[]; imports: string[] }>;
  edges: Array<{ from: string; to: string; symbols: string[] }>;
  cycles: string[][];
  summary: {
    totalFiles: number;
    totalEdges: number;
    cycleCount: number;
  };
}

function buildGraph(fileInfos: FileModuleInfo[], allFiles: Set<string>, entryPoints?: string[]): GraphResult {
  const nodes = new Map<string, NodeInfo>();
  // First, create nodes
  for (const info of fileInfos) {
    const id = info.file; // use absolute path as ID
    nodes.set(id, {
      id,
      file: info.file,
      exports: new Set(info.exports),
      imports: new Map(),
      incoming: new Set()
    });
  }

  // Second, resolve imports and create edges
  for (const info of fileInfos) {
    const fromId = info.file;
    const fromNode = nodes.get(fromId);
    if (!fromNode) continue;

    for (const [srcSpecifier, symbols] of info.imports) {
      let targetId: string | null = null;
      // Try resolve specifier to an internal file
      if (srcSpecifier.startsWith('.') || srcSpecifier.startsWith('/')) {
        // Resolve relative/absolute using the set of all files
        const resolved = resolveInAllFiles(srcSpecifier, info.file, allFiles);
        if (resolved) {
          targetId = resolved;
        }
      } else {
        // Could be a package; skip for now (not in codebase graph)
        continue;
      }

      const hasNode = nodes.has(targetId || '');
      if (targetId && hasNode) {
        fromNode.imports.set(targetId, symbols);
        const toNode = nodes.get(targetId)!;
        toNode.incoming.add(fromId);
      }
    }
  }

  // Build edges array
  const edges: Array<{ from: string; to: string; symbols: string[] }> = [];
  for (const [fromId, node] of nodes) {
    for (const [toId, symbols] of node.imports) {
      edges.push({ from: fromId, to: toId, symbols });
    }
  }

  // Detect cycles using DFS (Tarjan's algorithm would be overkill; simple cycle detection)
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  function dfs(nodeId: string) {
    visited.add(nodeId);
    stack.push(nodeId);
    onStack.add(nodeId);

    const node = nodes.get(nodeId)!;
    for (const [toId] of node.imports) {
      if (!visited.has(toId)) {
        dfs(toId);
      } else if (onStack.has(toId)) {
        // Cycle detected: from toId to nodeId
        const start = stack.indexOf(toId);
        if (start !== -1) {
          const cycle = stack.slice(start).concat(toId);
          cycles.push(cycle);
        }
      }
    }

    stack.pop();
    onStack.delete(nodeId);
  }

  for (const nodeId of nodes.keys()) {
    if (!visited.has(nodeId)) dfs(nodeId);
  }

  // Deduplicate cycles (order may differ)
  const uniqueCycles: string[][] = [];
  const cycleKeys = new Set<string>();
  for (const cycle of cycles) {
    const sorted = cycle.slice(0, -1).sort(); // remove duplicate last element
    const key = sorted.join('|');
    if (!cycleKeys.has(key)) {
      cycleKeys.add(key);
      uniqueCycles.push(cycle);
    }
  }


  // Determine reachable set based on entryPoints (if provided)
  let reachable: Set<string>;
  if (entryPoints && entryPoints.length > 0) {
    // Only consider entry points that exist in the graph (absolute paths expected)
    const entrySet = new Set(entryPoints.filter(p => nodes.has(p)));
    reachable = new Set<string>();
    const queue: string[] = Array.from(entrySet);
    for (const ep of entrySet) reachable.add(ep);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const curNode = nodes.get(cur)!;
      if (!curNode) continue;
      for (const [next] of curNode.imports) {
        if (!reachable.has(next)) {
          reachable.add(next);
          queue.push(next);
        }
      }
    }
  } else {
    // No filtering: include all nodes
    reachable = new Set(nodes.keys());
  }

  // Filter nodes, edges, cycles to reachable set
  const filteredNodes = new Map<string, NodeInfo>();
  for (const [id, node] of nodes) {
    if (reachable.has(id)) filteredNodes.set(id, node);
  }
  const filteredEdges = edges.filter(e => reachable.has(e.from) && reachable.has(e.to));
  const filteredCycles = uniqueCycles.filter(cycle => cycle.slice(0, -1).every(n => reachable.has(n)));

  // Summary
  const summary = {
    totalFiles: filteredNodes.size,
    totalEdges: filteredEdges.length,
    cycleCount: filteredCycles.length
  };

  // Convert nodes to arrays
  const nodeArray = Array.from(filteredNodes.values()).map(n => ({
    id: n.id,
    file: n.file,
    exports: Array.from(n.exports),
    imports: Array.from(n.imports.keys())
  }));

  return { nodes: nodeArray, edges: filteredEdges, cycles: filteredCycles, summary };
}

export const schema = Type.Object({
  files: Type.Array(Type.String(), { description: "List of file paths to analyze (relative to cwd)" }),
  entryPoints: Type.Array(Type.String(), { description: "Optional subset of files to treat as entry points. If omitted, files with no incoming imports are considered entries.", optional: true })
});

export async function execute(params: { files: string[]; entryPoints?: string[] }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();

  if (!params.files || params.files.length === 0) {
    return { content: [{ type: "text" as const, text: "No files provided" }], isError: true, details: { error: "files required" } };
  }

  // Read all files and parse AST
  const fileInfos: FileModuleInfo[] = [];
  const allFiles = new Set<string>();

  for (const relPath of params.files) {
    const absPath = join(cwd, relPath);
    // (removed debug)
    allFiles.add(absPath);
    try {
      const source = await fs.readFile(absPath, "utf-8");
      const info = await parseModule(absPath, source);
      fileInfos.push(info);
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error processing file ${relPath}: ${err.message}` }], isError: true, details: { file: relPath, error: err.message } };
    }
  }

  const absEntryPoints = params.entryPoints?.map(p => join(cwd, p));
  const absResult = buildGraph(fileInfos, allFiles, absEntryPoints);
  // Convert to relative paths for output
  const relResult = {
    nodes: absResult.nodes.map(n => ({
      id: relative(cwd, n.id),
      file: relative(cwd, n.file),
      exports: n.exports,
      imports: n.imports.map((imp: string) => relative(cwd, imp))
    })),
    edges: absResult.edges.map(e => ({
      from: relative(cwd, e.from),
      to: relative(cwd, e.to),
      symbols: e.symbols
    })),
    cycles: absResult.cycles.map(cycle => cycle.map(p => relative(cwd, p))),
    summary: absResult.summary
  };
  // Format output as readable text and include structured details
  const output = formatOutput(relResult, params.entryPoints || []);
  return { content: [{ type: "text" as const, text: output }], isError: false, details: relResult };
}

function formatOutput(g: GraphResult, entryPoints: string[]): string {
  let txt = `📦 Dependency Tree Analysis\n\n`;
  txt += `📊 Summary:\n`;
  txt += `   Files: ${g.summary.totalFiles}\n`;
  txt += `   Import edges: ${g.summary.totalEdges}\n`;
  txt += `   Cycles detected: ${g.summary.cycleCount}\n\n`;

  if (entryPoints.length > 0) {
    txt += `🚪 Entry Points: ${entryPoints.length}\n`;
    entryPoints.forEach(ep => txt += `   - ${ep}\n`);
    txt += '\n';
  }

  if (g.cycles.length > 0) {
    txt += `⚠️  Cycles:\n`;
    g.cycles.forEach((cycle, i) => {
      txt += `   Cycle ${i + 1}: ${cycle.join(' → ')}\n`;
    });
    txt += '\n';
  }

  txt += `📋 Nodes (${g.nodes.length}):\n`;
  g.nodes.forEach(n => {
    txt += `   ${n.file}\n`;
    txt += `     Exports: ${n.exports.join(', ') || '(none)'}\n`;
    txt += `     Imports from: ${n.imports.join(', ') || '(none)'}\n`;
  });

  txt += `\n🔗 Edges (${g.edges.length}):\n`;
  g.edges.forEach(e => {
    txt += `   ${e.from} → ${e.to} [${e.symbols.join(', ')}]\n`;
  });

  return txt;
}
