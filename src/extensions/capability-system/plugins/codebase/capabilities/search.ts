#!/usr/bin/env node
/**
 * codebase.search capability
 *
 * Searches code files for a query string (case-sensitive or insensitive).
 * Returns matching lines with file path, line number, column, and snippet.
 */

import { Type } from "typebox";
import { promises as fs } from "fs";
import { join, extname, relative, dirname, parse } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md'];

export const schema = Type.Object({
  query: Type.String({ description: "Search query (plain text)" }),
  filePattern: Type.Optional(Type.String({ description: "Optional file extension filter (e.g., '.ts') or partial path" })),
  maxResults: Type.Optional(Type.Integer({ description: "Maximum results to return (default 50)" })),
  caseSensitive: Type.Optional(Type.Boolean({ description: "Case-sensitive search (default false)" }))
}, { additionalProperties: false });

interface SearchMatch {
  file: string;
  line: number;
  column: number;
  text: string;
}

async function walkDir(dir: string, callback: (filePath: string) => Promise<void> | void, opts: { ignoreDirs?: string[] } = {}): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' || entry.name === 'coverage' || entry.name === '.next') {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(full, callback, opts);
    } else if (entry.isFile()) {
      await callback(full);
    }
  }
}

export async function execute(params: { query: string; filePattern?: string; maxResults?: number; caseSensitive?: boolean }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();
  const query = params.query;
  if (!query) {
    return { content: [{ type: "text", text: "Query is required" }], isError: true };
  }
  const maxResults = params.maxResults ?? 50;
  const caseSensitive = params.caseSensitive ?? false;
  const filePattern = params.filePattern?.toLowerCase();

  const matches: SearchMatch[] = [];

  const processFile = async (filePath: string) => {
    if (matches.length >= maxResults) return;

    const ext = extname(filePath).toLowerCase();
    if (!CODE_EXTENSIONS.includes(ext)) return;
    if (filePattern && !filePattern.includes(ext) && !filePath.toLowerCase().includes(filePattern.toLowerCase())) {
      // If filePattern is provided and doesn't match extension or path substring, skip
      // Simple heuristic: if filePattern is like '.ts', check extension; else check if file path contains pattern.
      // This is a simplification.
      if (filePattern.startsWith('.') && ext !== filePattern.toLowerCase()) return;
      if (!filePath.toLowerCase().includes(filePattern.toLowerCase())) return;
    }

    try {
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const searchIn = caseSensitive ? line : line.toLowerCase();
        const q = caseSensitive ? query : query.toLowerCase();
        const idx = searchIn.indexOf(q);
        if (idx !== -1) {
          const relPath = relative(cwd, filePath);
          matches.push({
            file: relPath,
            line: i + 1,
            column: idx + 1,
            text: line.trim().substring(0, 120) // limit snippet length
          });
          if (matches.length >= maxResults) break;
        }
      }
    } catch (err) {
      // Ignore unreadable files
    }
  };

  try {
    await walkDir(cwd, processFile);
  } catch (err) {
    // ignore
  }

  const output = matches.length === 0
    ? `No matches for "${query}"`
    : matches.map(m => `${m.file}:${m.line}:${m.column}: ${m.text}`).join('\n');

  return {
    content: [{ type: "text" as const, text: output }],
    details: { matches, total: matches.length, query },
    isError: false
  };
}

export default { execute, schema };
