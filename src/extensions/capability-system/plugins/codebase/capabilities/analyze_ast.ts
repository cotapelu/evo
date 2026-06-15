#!/usr/bin/env node
/**
 * codebase.analyze_ast capability
 *
 * Deep analysis using @typescript-eslint/parser to extract accurate symbols,
 * imports, exports, and type information from TypeScript/JavaScript.
 *
 * More accurate than regex-based analyze but slower.
 */

import { Type } from "typebox";
import { promises as fs } from "fs";
import { join, relative, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const schema = Type.Object({
  file: Type.String({ description: "File path to analyze (relative to cwd)" })
}, { required: ["file"], additionalProperties: false });

interface ImportInfo {
  moduleSpecifier: string;
  importClause?: string;
  namedImports?: string[];
  typeOnly?: boolean;
}

interface ExportInfo {
  type: "named" | "default" | "type" | "all";
  name?: string;
  aliases?: string[];
}

interface SymbolDef {
  name: string;
  kind: "function" | "class" | "interface" | "type" | "variable" | "enum" | "const" | "let";
  line: number;
  column?: number;
}

interface AnalysisResult {
  file: string;
  exists: boolean;
  language: "ts" | "tsx" | "js" | "jsx" | "unknown";
  lines: number;
  imports: ImportInfo[];
  exports: ExportInfo[];
  symbols: SymbolDef[];
  error?: string;
}

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

export async function execute(params: { file: string }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();
  const filePath = join(cwd, params.file);

  try {
    try {
      await fs.access(filePath);
    } catch {
      return { content: [{ type: "text" as const, text: `File not found: ${params.file}` }], isError: true, details: { file: params.file, exists: false } };
    }

    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split('\n').length;

    const ext = params.file.split('.').pop()?.toLowerCase();
    const language = (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') ? (ext as any) : "unknown";

    const result: AnalysisResult = {
      file: params.file,
      exists: true,
      language,
      lines,
      imports: [],
      exports: [],
      symbols: []
    };

    // @ts-ignore - dynamic import for parser
    const parser = await import("@typescript-eslint/parser");
    const { parse } = parser as any;
    let ast;
    try {
      ast = parse(content, {
        sourceType: "module",
        ecmaVersion: "latest",
        ts: true,
        jsx: true,
        range: false,
        loc: true
      });
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Parse error: ${err.message}` }], isError: true, details: { file: params.file, error: err.message } };
    }

    // Walk AST
    walk(ast, (node: any, parent?: any) => {
      // Imports
      if (node.type === 'ImportDeclaration') {
        const specifier = node.source.value;
        const importInfo: ImportInfo = { moduleSpecifier: specifier };
        const named: string[] = [];
        let defaultImport: string | null = null;
        let namespace: string | null = null;
        node.specifiers.forEach((sp: any) => {
          if (sp.type === 'ImportSpecifier') {
            named.push(sp.local.name);
          } else if (sp.type === 'ImportDefaultSpecifier') {
            defaultImport = sp.local.name;
          } else if (sp.type === 'ImportNamespaceSpecifier') {
            namespace = sp.local.name;
          }
        });
        if (defaultImport) importInfo.importClause = defaultImport;
        if (namespace) importInfo.importClause = `* as ${namespace}`;
        if (named.length) importInfo.namedImports = named;
        if (node.importKind === 'type') importInfo.typeOnly = true;
        result.imports.push(importInfo);
      }

      // Exports
      if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration) {
          // export const x = ...
          // The declaration node will be handled separately in symbols
          // But we record the export
          if (node.declaration.type === 'VariableDeclaration') {
            node.declaration.declarations.forEach((decl: any) => {
              result.exports.push({ type: "named", name: decl.id.name });
              result.symbols.push({ name: decl.id.name, kind: "variable", line: decl.loc.start.line });
            });
          } else if (node.declaration.type === 'FunctionDeclaration') {
            result.exports.push({ type: "named", name: node.declaration.id?.name || '<anonymous>' });
            result.symbols.push({ name: node.declaration.id?.name || '<anonymous>', kind: "function", line: node.declaration.loc.start.line });
          } else if (node.declaration.type === 'ClassDeclaration') {
            result.exports.push({ type: "named", name: node.declaration.id?.name || '<anonymous>' });
            result.symbols.push({ name: node.declaration.id?.name || '<anonymous>', kind: "class", line: node.declaration.loc.start.line });
          } else if (node.declaration.type === 'TSTypeAliasDeclaration') {
            result.exports.push({ type: "named", name: node.declaration.id.name });
            result.symbols.push({ name: node.declaration.id.name, kind: "type", line: node.declaration.loc.start.line });
          } else if (node.declaration.type === 'TSInterfaceDeclaration') {
            result.exports.push({ type: "named", name: node.declaration.id.name });
            result.symbols.push({ name: node.declaration.id.name, kind: "interface", line: node.declaration.loc.start.line });
          }
        } else if (node.specifiers) {
          // export { a, b as c }
          node.specifiers.forEach((sp: any) => {
            if (sp.type === 'ExportSpecifier') {
              result.exports.push({ type: "named", name: sp.exported.name, aliases: sp.local.name !== sp.exported.name ? [sp.local.name] : undefined });
            }
          });
        }
      }

      if (node.type === 'ExportDefaultDeclaration') {
        if (node.declaration) {
          const dec = node.declaration;
          let kind: SymbolDef['kind'] = 'variable';
          let name: string = '<anonymous>';
          if (dec.type === 'FunctionDeclaration') {
            kind = 'function';
            name = dec.id?.name || '<anonymous>';
          } else if (dec.type === 'ClassDeclaration') {
            kind = 'class';
            name = dec.id?.name || '<anonymous>';
          } else if (dec.type === 'Identifier') {
            name = dec.name;
          } else if (dec.type === 'CallExpression' || dec.type === 'ArrowFunctionExpression') {
            // default export anonymous function, no name
            name = '<default function>';
            kind = 'function';
          }
          result.exports.push({ type: "default", name });
          if (name !== '<anonymous>' && name !== '<default function>') {
            result.symbols.push({ name, kind, line: dec.loc.start.line });
          }
        } else {
          result.exports.push({ type: "default", name: '<<unknown>>' });
        }
      }

      if (node.type === 'ExportAllDeclaration') {
        result.exports.push({ type: "all" });
      }

      // Functions (declarations)
      if (node.type === 'FunctionDeclaration' && node.id) {
        // Already handled by export? But could be non-exported function
        // Check if not already added
        const exists = result.symbols.some(s => s.name === node.id.name && s.kind === 'function' && s.line === node.loc.start.line);
        if (!exists) {
          result.symbols.push({ name: node.id.name, kind: "function", line: node.loc.start.line });
        }
      }

      // Classes
      if (node.type === 'ClassDeclaration' && node.id) {
        const exists = result.symbols.some(s => s.name === node.id.name && s.kind === 'class' && s.line === node.loc.start.line);
        if (!exists) {
          result.symbols.push({ name: node.id.name, kind: "class", line: node.loc.start.line });
        }
      }

      // Variable declarations (const/let/var)
      if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
        const parentKind = parent?.kind as 'const' | 'let' | 'var' | undefined;
        let kind: SymbolDef['kind'] = 'variable';
        if (parentKind === 'const') kind = 'const';
        else if (parentKind === 'let') kind = 'let';
        else if (parentKind === 'var') kind = 'variable';
        // Check duplicates
        const exists = result.symbols.some(s => s.name === node.id.name && s.kind === kind && s.line === node.loc.start.line);
        if (!exists) {
          result.symbols.push({ name: node.id.name, kind: kind as SymbolDef['kind'], line: node.loc.start.line, column: node.loc.start.column });
        }
      }

      // TS Interface and TypeAlias: use ESTree? Parser adds extra types.
      // For TS, node.type could be 'TSTypeAliasDeclaration', 'TSInterfaceDeclaration'
      if (node.type === 'TSTypeAliasDeclaration' && node.id) {
        result.symbols.push({ name: node.id.name, kind: "type", line: node.loc.start.line });
        // Exports handled separately; but if exported, it'll appear in ExportNamedDeclaration with declarand?
        // We'll also add export if parent is ExportNamedDeclaration? Actually our walk captures ExportNamedDeclaration earlier.
        // We can also push to exports if we see it's exported via the node's parent? Simpler: if a ExportNamedDeclaration with this symbol was already recorded, we are fine. But we may miss marking it as export if not captured. For now, rely on ExportNamedDeclaration handling.
      }
      if (node.type === 'TSInterfaceDeclaration' && node.id) {
        result.symbols.push({ name: node.id.name, kind: "interface", line: node.loc.start.line });
      }
      if (node.type === 'TSEnumDeclaration' && node.id) {
        result.symbols.push({ name: node.id.name, kind: "enum", line: node.loc.start.line });
      }
    });

    // Build result summary text
    const summary = `
📄 File: ${params.file}
📏 Lines: ${lines}
🔤 Language: ${language}

📥 Imports (${result.imports.length}):
${result.imports.map((imp, i) => `  ${i+1}. ${imp.importClause ? imp.importClause + ' ' : ''}from "${imp.moduleSpecifier}"`).join('\n')}

📤 Exports (${result.exports.length}):
${result.exports.map((exp, i) => `  ${i+1}. ${exp.type} ${exp.name || ''}${exp.aliases ? ' as ' + exp.aliases.join(', ') : ''}`).join('\n')}

🔧 Symbols (${result.symbols.length}):
${result.symbols.map((sym, i) => `  ${i+1}. ${sym.kind} ${sym.name} (line ${sym.line})`).join('\n')}
`.trim();

    return {
      content: [{ type: "text" as const, text: summary }],
      details: result,
      isError: false
    };
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: `❌ Error: ${msg}` }], isError: true, details: { file: params.file, error: msg } };
  }
}

export default { execute, schema };
