/**
 * Pattern Detection and Learning System
 *
 * Analyzes reference code examples and current codebase to identify
 * improvement opportunities based on coding patterns.
 */

import { readFile, readdir, stat } from 'fs/promises';
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
    id: 'use-async-await',
    name: 'Prefer async/await over Promise chains',
    description: 'Use async/await for better readability in async functions',
    severity: 'warning',
    check: (code) => {
      // Look for .then() chains in async functions
      const hasThen = /\.then\s*\(/.test(code);
      const hasAsync = /\basync\s+function/.test(code) || /\(\s*\)\s*=>\s*{[\s\S]*?async/.test(code);
      if (hasThen && hasAsync) {
        return {
          patternId: 'use-async-await',
          line: 1,
          column: 1,
          message: 'Consider using async/await instead of .then() chains',
          suggestedFix: 'Rewrite Promise chains as async/await'
        };
      }
      return null;
    },
    fix: (code) => {
      // Very basic transformation - a real implementation would use AST
      return code.replace(/\.then\s*\(\s*\(([^)]+)\)\s*=>\s*{([\s\S]*?)}\s*\)\s*\.catch\s*\(\s*\(([^)]+)\)\s*=>\s*{([\s\S]*?)}\s*\)/g,
        'try {\n  const $1 = await ...;\n  $2\n} catch ($3) {\n  $4\n}');
    }
  },
  {
    id: 'proper-error-handling',
    name: 'Handle errors in async functions',
    description: 'Async functions should have try/catch error handling',
    severity: 'warning',
    check: (code) => {
      // Check for async functions without try/catch
      const asyncFuncMatch = code.match(/\basync\s+function\s+\w+\s*\([^)]*\)\s*{([\s\S]*?)}/);
      if (asyncFuncMatch) {
        const body = asyncFuncMatch[1];
        if (!body.includes('try') && !body.includes('catch')) {
          return {
            patternId: 'proper-error-handling',
            line: 1,
            column: 1,
            message: 'Async function should include error handling',
            suggestedFix: 'Wrap async code in try/catch'
          };
        }
      }
      return null;
    },
    fix: (code) => code // placeholder - would need AST transformation
  },
  {
    id: 'avoid-global-object',
    name: 'Avoid globalThis usage',
    description: 'Do not use globalThis directly; use local scope',
    severity: 'error',
    check: (code) => {
      // Detect usage of global object via globalThis (avoid false positive on pattern definition)
      const pattern = new RegExp('\\bglobalThis\\b');;
      const lines = code.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          return {
            patternId: 'avoid-global-object',
            line: i + 1,
            column: 1,
            message: 'Avoid using globalThis; use local variables or dependency injection',
            suggestedFix: 'Replace globalThis with local scope or imported module'
            };
        }
      }
      return null;
    },
    fix: (code) => code // requires manual refactoring
  }
];

export async function scanDirectory(dir: string, exts: string[] = ['.ts']): Promise<Map<string, PatternMatch[]>> {
  const results = new Map<string, PatternMatch[]>();

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await walk(fullPath);
      } else if (entry.isFile() && exts.includes(extname(fullPath))) {
        try {
          const content = await readFile(fullPath, 'utf-8');
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
          // Skip files we can't read
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
