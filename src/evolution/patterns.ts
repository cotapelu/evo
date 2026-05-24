/**
 * Pattern Detection and Learning System
 *
 * Analyzes reference code examples and current codebase to identify
 * improvement opportunities based on coding patterns.
 */

import { readFile, readdir, stat } from 'fs/promises';
import { FileCache } from './cache.js';
import { join, relative, extname, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface Pattern {
  id: string;
  name: string;
  description: string;
  check: (code: string, filePath: string) => PatternMatch | null;
  fix: (code: string, filePath: string) => string;
  severity: 'info' | 'warning' | 'error';
}

export interface PatternMatch {
  patternId: string;
  line: number;
  column: number;
  message: string;
  suggestedFix: string;
}

// Example patterns extracted from reference code

export const patterns: Pattern[] = [
  {
    id: 'trailing-whitespace',
    name: 'Remove trailing whitespace',
    description: 'Lines should not end with spaces or tabs',
    severity: 'info',
    check: (code) => {
      const lines = code.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/\s+$/)) {
          return {
            patternId: 'trailing-whitespace',
            line: i + 1,
            column: 1,
            message: 'Trailing whitespace detected',
            suggestedFix: 'Remove trailing spaces/tabs'
          };
        }
      }
      return null;
    },
    fix: (code) => {
      return code.split('\n').map(line => line.replace(/\s+$/, '')).join('\n');
    }
  },
  {
    id: 'missing-eof-newline',
    name: 'Ensure file ends with newline',
    description: 'POSIX standard: text files should end with newline',
    severity: 'info',
    check: (code) => {
      if (!code.endsWith('\n')) {
        return {
          patternId: 'missing-eof-newline',
          line: code.split('\n').length + 1,
          column: 1,
          message: 'File does not end with newline',
          suggestedFix: 'Add newline at end of file'
        };
      }
      return null;
    },
    fix: (code) => {
      return code.endsWith('\n') ? code : code + '\n';
    }
  },

];

export async function scanDirectory(
  dir: string,
  exts: string[] = ['.ts'],
  options: { exclude?: string[]; cache?: FileCache } = {}
): Promise<Map<string, PatternMatch[]>> {
  const results = new Map<string, PatternMatch[]>();
  const defaultExclude = ['node_modules', 'dist', '.git', '__tests__', '__mocks__'];
  const excludeDirs = new Set([...defaultExclude, ...(options.exclude || [])]);

  function shouldSkipDir(dirName: string): boolean {
    return excludeDirs.has(dirName) || dirName.startsWith('.');
  }

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory() && !(await shouldSkipDir(entry.name))) {
        await walk(fullPath);
      } else if (entry.isFile() && exts.includes(extname(fullPath))) {
        try {
          // Get file stat for cache validation
          const statResult = await stat(fullPath);

          // Try cache first
          let content: string;
          if (options.cache) {
            const cached = await options.cache.get(fullPath, statResult);
            if (cached !== null) {
              content = cached;
            } else {
              content = await readFile(fullPath, 'utf-8');
              options.cache.set(fullPath, content, statResult);
            }
          } else {
            content = await readFile(fullPath, 'utf-8');
          }

          const matches: PatternMatch[] = [];

          for (const pattern of patterns) {
            const match = pattern.check(content, fullPath);
            if (match) {
              matches.push(match);
            }
          }

          if (matches.length > 0) {
            results.set(fullPath, matches);
          }
        } catch (err) {
          // Skip files we can't read, but warn for visibility
          console.warn(`   Warning: Skipping unreadable file: ${relative(process.cwd(), fullPath)} (${err instanceof Error ? err.message : err})`);
        }
      }
    }
  }

  await walk(dir);
  return results;
}

export function generateReport(results: Map<string, PatternMatch[]>): string {
  let report = 'Pattern Analysis Report\n';
  report += '======================\n\n';

  let totalMatches = 0;
  for (const [file, matches] of results) {
    report += `File: ${relative(process.cwd(), file)}\n`;
    for (const match of matches) {
      totalMatches++;
      const pattern = patterns.find(p => p.id === match.patternId);
      report += `  Line ${match.line}: [${match.patternId}] ${match.message}\n`;
      if (pattern) {
        report += `    Severity: ${pattern.severity}\n`;
        report += `    Suggestion: ${pattern.description}\n`;
      }
    }
    report += '\n';
  }

  report += `Total issues found: ${totalMatches}\n`;
  return report;
}
