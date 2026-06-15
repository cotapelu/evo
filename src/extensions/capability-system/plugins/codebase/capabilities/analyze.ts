#!/usr/bin/env node
/**
 * codebase.analyze capability
 *
 * Analyzes a TypeScript/JavaScript file to extract:
 * - Imports (external and internal)
 * - Exports (named, default, type)
 * - Defined symbols (functions, classes, interfaces, types, variables)
 * - File statistics (lines, language)
 *
 * Returns structured data for LLM consumption.
 */

import { Type } from "typebox";
import { promises as fs } from "fs";
import { join } from "path";

export const schema = Type.Object({
  file: Type.String({ description: "File path to analyze (relative to cwd)" })
}, { required: ["file"], additionalProperties: false });

// Type guard for valid file extensions
function isCodeExtension(ext: string): ext is 'ts' | 'tsx' | 'js' | 'jsx' | 'json' {
  return ['ts', 'tsx', 'js', 'jsx', 'json'].includes(ext);
}

interface ImportInfo {
  moduleSpecifier: string;
  importClause?: string; // default, * as ns, { named }
  namedImports?: string[];
  typeOnly?: boolean;
}

interface ExportInfo {
  type: "named" | "default" | "type";
  name: string;
  aliases?: string[]; // export { foo as bar }
}

interface SymbolDef {
  name: string;
  kind: "function" | "class" | "interface" | "type" | "variable" | "enum" | "const" | "let";
  line: number;
  column?: number;
  signature?: string;
}

interface AnalysisResult {
  file: string;
  exists: boolean;
  language: "ts" | "tsx" | "js" | "jsx" | "json" | "unknown";
  lines: number;
  imports: ImportInfo[];
  exports: ExportInfo[];
  symbols: SymbolDef[];
  error?: string;
}

// Simple regex-based analyzer (lightweight, no external parser)
// This is a heuristic analyzer suitable for LLM context.
function analyzeContent(content: string): { imports: ImportInfo[]; exports: ExportInfo[]; symbols: SymbolDef[] } {
  const lines = content.split('\n');
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const symbols: SymbolDef[] = [];

  // Patterns
  const importDecl = /^\s*import\s+(?:(\*)\s*as\s+(\w+)|({[\s\S]*?})|(\w+))\s*from\s*['"]([^'"]+)['"];?/;
  const exportDecl = /^\s*export\s+(?:(\*)\s*from\s*['"][^'"]+['"];?|({[\s\S]*?})|(\w+)(\s+as\s+(\w+))?|default\s+(\w+))/;
  const functionDecl = /^\s*(?:async\s+)?function\s+(\w+)\s*\(/;
  const classDecl = /^\s*class\s+(\w+)/;
  const interfaceDecl = /^\s*interface\s+(\w+)/;
  const typeDecl = /^\s*type\s+(\w+)\s*=/;
  const varDecl = /^\s*(?:const|let)\s+(\w+)\s*[=;]/;
  const enumDecl = /^\s*enum\s+(\w+)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Imports
    const importMatch = line.match(importDecl);
    if (importMatch) {
      const [_, starAs, namedGroup, defaultImport, moduleSpecifier] = importMatch;
      const importInfo: ImportInfo = { moduleSpecifier };
      if (starAs) {
        importInfo.importClause = `* as ${starAs}`;
      } else if (namedGroup) {
        // Parse { a, b as c }
        const namedStr = namedGroup.slice(1, -1).trim();
        if (namedStr) {
          const parts = namedStr.split(',').map(p => p.trim());
          importInfo.namedImports = parts.map(p => {
            const [name, alias] = p.split(/\s+as\s+/);
            return alias || name;
          });
          importInfo.importClause = `{ ${namedStr} }`;
        }
      } else if (defaultImport) {
        importInfo.importClause = defaultImport;
      }
      // Check for type-only? Not fully parsed, assume if line contains 'type' keyword? Skip for now.
      imports.push(importInfo);
      continue;
    }

    // Exports - first check for default declarations with keywords
    let handled = false;

    // export default class Foo
    const exportDefaultClass = line.match(/^\s*export\s+default\s+class\s+(\w+)/);
    if (exportDefaultClass) {
      symbols.push({ name: exportDefaultClass[1], kind: "class", line: lineNum });
      exports.push({ type: "default", name: exportDefaultClass[1] });
      handled = true;
    }

    // export default interface Foo
    const exportDefaultInterface = line.match(/^\s*export\s+default\s+interface\s+(\w+)/);
    if (exportDefaultInterface) {
      symbols.push({ name: exportDefaultInterface[1], kind: "interface", line: lineNum });
      exports.push({ type: "default", name: exportDefaultInterface[1] });
      handled = true;
    }

    // export default type Foo = ...
    const exportDefaultType = line.match(/^\s*export\s+default\s+type\s+(\w+)\s*=/);
    if (exportDefaultType) {
      symbols.push({ name: exportDefaultType[1], kind: "type", line: lineNum });
      exports.push({ type: "default", name: exportDefaultType[1] });
      handled = true;
    }

    // export default function foo(...)
    const exportDefaultFunction = line.match(/^\s*export\s+default\s+function\s+(\w+)\s*\(/);
    if (exportDefaultFunction) {
      symbols.push({ name: exportDefaultFunction[1], kind: "function", line: lineNum });
      exports.push({ type: "default", name: exportDefaultFunction[1] });
      handled = true;
    }

    // export default const/let/var
    const exportDefaultVar = line.match(/^\s*export\s+default\s+(const|let|var)\s+(\w+)/);
    if (exportDefaultVar) {
      symbols.push({ name: exportDefaultVar[2], kind: "variable", line: lineNum });
      exports.push({ type: "default", name: exportDefaultVar[2] });
      handled = true;
    }

    // export type Foo = ...
    const exportTypeMatch = line.match(/^\s*export\s+type\s+(\w+)\s*=/);
    if (exportTypeMatch) {
      symbols.push({ name: exportTypeMatch[1], kind: "type", line: lineNum });
      exports.push({ type: "named", name: exportTypeMatch[1] });
      handled = true;
    }

    // export interface Foo
    const exportInterfaceMatch = line.match(/^\s*export\s+interface\s+(\w+)/);
    if (exportInterfaceMatch) {
      symbols.push({ name: exportInterfaceMatch[1], kind: "interface", line: lineNum });
      exports.push({ type: "named", name: exportInterfaceMatch[1] });
      handled = true;
    }

    // If already handled by default declarations, skip to next line
    if (handled) continue;

    // Existing exportDecl handling for other forms
    const exportMatch = line.match(exportDecl);
    if (exportMatch) {
      const [_, starFrom, namedGroup, exportName, asAlias1, aliasName, defaultName] = exportMatch;
      if (starFrom) {
        exports.push({ type: "named", name: "*" });
      } else if (namedGroup) {
        const namedStr = namedGroup.slice(1, -1).trim();
        if (namedStr) {
          const parts = namedStr.split(',').map(p => p.trim());
          parts.forEach(p => {
            const [name, alias] = p.split(/\s+as\s+/);
            exports.push({ type: "named", name, aliases: alias ? [alias] : undefined });
          });
        }
      } else if (exportName) {
        exports.push({ type: "named", name: exportName, ...(asAlias1 && aliasName ? { aliases: [aliasName] } : {}) });
      } else if (defaultName) {
        exports.push({ type: "default", name: defaultName });
      }
      continue;
    }

    // Function
    const funcMatch = line.match(functionDecl);
    if (funcMatch) {
      symbols.push({ name: funcMatch[1], kind: "function", line: lineNum });
      continue;
    }

    // Class
    const classMatch = line.match(classDecl);
    if (classMatch) {
      symbols.push({ name: classMatch[1], kind: "class", line: lineNum });
      continue;
    }

    // Interface
    const interfaceMatch = line.match(interfaceDecl);
    if (interfaceMatch) {
      symbols.push({ name: interfaceMatch[1], kind: "interface", line: lineNum });
      continue;
    }

    // Type alias
    const typeMatch = line.match(typeDecl);
    if (typeMatch) {
      symbols.push({ name: typeMatch[1], kind: "type", line: lineNum });
      continue;
    }

    // Variable (const/let)
    const varMatch = line.match(varDecl);
    if (varMatch) {
      symbols.push({ name: varMatch[1], kind: "variable", line: lineNum });
      continue;
    }

    // Enum
    const enumMatch = line.match(enumDecl);
    if (enumMatch) {
      symbols.push({ name: enumMatch[1], kind: "enum", line: lineNum });
      continue;
    }
  }

  return { imports, exports, symbols };
}

export async function execute(params: { file: string }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();
  const filePath = join(cwd, params.file);

  try {
    // Check file exists
    try {
      await fs.access(filePath);
    } catch {
      return {
        content: [{ type: "text" as const, text: `File not found: ${params.file}` }],
        isError: true,
        details: { file: params.file, exists: false }
      };
    }

    // Read file
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split('\n').length;

    // Determine language from extension
    const ext = params.file.split('.').pop()?.toLowerCase() ?? '';
    const language = isCodeExtension(ext) ? ext : 'unknown';

    // Analyze
    const { imports, exports, symbols } = analyzeContent(content);

    const result: AnalysisResult = {
      file: params.file,
      exists: true,
      language,
      lines,
      imports,
      exports,
      symbols
    };

    // Format result as readable text + JSON
    const summary = `
📄 File: ${params.file}
📏 Lines: ${lines}
🔤 Language: ${language}

📥 Imports (${imports.length}):
${imports.map((imp, i) => `  ${i+1}. ${imp.importClause ? imp.importClause + ' ' : ''}from "${imp.moduleSpecifier}"`).join('\n')}

📤 Exports (${exports.length}):
${exports.map((exp, i) => `  ${i+1}. ${exp.type} ${exp.name}${exp.aliases ? ' as ' + exp.aliases.join(', ') : ''}`).join('\n')}

🔧 Symbols (${symbols.length}):
${symbols.map((sym, i) => `  ${i+1}. ${sym.kind} ${sym.name} (line ${sym.line})`).join('\n')}
`.trim();

    return {
      content: [{ type: "text" as const, text: summary }],
      details: result,
      isError: false
    };
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: `❌ Error: ${msg}` }],
      isError: true,
      details: { file: params.file, error: msg }
    };
  }
}

export default { execute, schema };
