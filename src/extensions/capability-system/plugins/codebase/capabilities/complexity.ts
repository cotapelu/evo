#!/usr/bin/env node
/**
 * codebase.complexity capability
 *
 * Computes code complexity metrics: cyclomatic complexity, Halstead metrics,
 * maintainability index, and other quality indicators for a file.
 */

import { Type } from "typebox";
import { promises as fs } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple walker
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

// Count decision points for cyclomatic complexity
function countDecisions(node: any): number {
  let count = 0;
  walk(node, (n: any) => {
    switch (n.type) {
      case 'IfStatement':
      case 'ConditionalExpression':
        count++; break;
      case 'SwitchStatement':
        count += n.cases.length - 1 || 0; // each case after first adds a path
        break;
      case 'ForStatement':
      case 'WhileStatement':
      case 'DoWhileStatement':
        count++; // loops add a decision point
        break;
      case 'LogicalExpression':
        // && and || operators add decision points
        if (n.operator === '&&' || n.operator === '||') count++;
        break;
      case 'CatchClause':
        count++; // exception handler
        break;
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
      case 'FunctionDeclaration':
        // each conditional operator in function body counts
        if (n.body) {
          count += countDecisions(n.body);
        }
        break;
    }
  });
  return count;
}

// Collect operators and operands for Halstead metrics
interface HalsteadCounts {
  operators: Map<string, number>;
  operands: Map<string, number>;
}

function collectHalstead(node: any, counts: HalsteadCounts) {
  const operators = ['=', '==', '===', '!=', '!==', '<', '>', '<=', '>=', '+', '-', '*', '/', '%', '&', '|', '^', '&&', '||', '!', '??', '?:', '=>', '...', '++', '--', '<<', '>>', '>>>'];
  const keywords = ['if', 'else', 'switch', 'case', 'default', 'for', 'while', 'do', 'break', 'continue', 'return', 'throw', 'try', 'catch', 'finally', 'function', 'class', 'var', 'let', 'const', 'new', 'this', 'super', 'typeof', 'instanceof', 'void', 'delete', 'in', 'of', 'as', 'from', 'export', 'import', 'default', 'extends', 'implements', 'interface', 'type', 'enum', 'public', 'private', 'protected', 'static', 'readonly', 'abstract', 'async', 'await'];

  function addOperator(op: string) {
    if (operators.includes(op) || keywords.includes(op)) {
      counts.operators.set(op, (counts.operators.get(op) || 0) + 1);
    }
  }

  function addOperand(operand: string) {
    if (operand && !['true', 'false', 'null', 'undefined'].includes(operand)) {
      counts.operands.set(operand, (counts.operands.get(operand) || 0) + 1);
    }
  }

  const visitor = (n: any) => {
    // Operators
    if (n.operator) addOperator(n.operator);
    if (n.left && n.left.type === 'Identifier') addOperand(n.left.name);
    if (n.right && n.right.type === 'Identifier') addOperand(n.right.name);

    // Function calls: function name is operand, arguments are operands
    if (n.type === 'CallExpression') {
      if (n.callee.type === 'Identifier') {
        addOperand(n.callee.name);
      } else if (n.callee.type === 'MemberExpression') {
        // dot access: property name as operand
        if (n.callee.property.type === 'Identifier') {
          addOperand(n.callee.property.name);
        }
      }
      n.arguments?.forEach((arg: any) => {
        if (arg.type === 'Identifier') addOperand(arg.name);
      });
    }

    // Variable declarations
    if (n.type === 'VariableDeclarator') {
      if (n.id.type === 'Identifier') addOperand(n.id.name);
    }

    // Property access in member expressions
    if (n.type === 'MemberExpression' && n.property.type === 'Identifier') {
      addOperand(n.property.name);
    }

    // Literals as operands (string/numeric literals count once per unique value)
    if (n.type === 'Literal' || n.type === 'TemplateLiteral') {
      const val = n.value !== undefined ? String(n.value) : '<template>';
      addOperand(val);
    }
  };

  walk(node, visitor);
}

// Halstead metrics calculations
function computeHalstead(counts: HalsteadCounts): any {
  const n1 = counts.operators.size;
  const n2 = counts.operands.size;
  let N1 = 0, N2 = 0;
  counts.operators.forEach(v => N1 += v);
  counts.operands.forEach(v => N2 += v);

  const vocabulary = n1 + n2;
  const length = N1 + N2;
  const volume = length * Math.log2(vocabulary) || 0;
  const difficulty = (n1 / 2) * (N2 / n2) || 0;
  const effort = difficulty * volume;
  const bugs = volume / 3000; // industry approximation

  return { n1, n2, N1, N2, vocabulary, length, volume, difficulty, effort, bugs };
}

// Maintainability Index (MI) calculation
// Original MI = 171 - 5.2 * ln(volume) - 0.23 * cyclomatic - 16.2 * ln(loc)
// We'll use simplified version per maintainability
function computeMaintainabilityIndex(volume: number, cyclomatic: number, lines: number): number {
  const lnVolume = Math.log(volume) || 0;
  const lnLoc = Math.log(lines) || 0;
  const raw = 171 - 5.2 * lnVolume - 0.23 * cyclomatic - 16.2 * lnLoc;
  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, raw));
}

interface ComplexityResult {
  file: string;
  exists: boolean;
  language: "ts" | "tsx" | "js" | "jsx" | "unknown";
  lines: number;
  functions: number;
  cyclomatic: number;
  halstead: {
    volume: number;
    difficulty: number;
    effort: number;
    bugs: number;
  };
  maintainability: number;
  error?: string;
}

export const schema = Type.Object({
  file: Type.String({ description: "File path to analyze (relative to cwd)" })
});

export async function execute(params: { file: string }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();
  const filePath = join(cwd, params.file);

  try {
    await fs.access(filePath);
  } catch {
    return { content: [{ type: "text" as const, text: `File not found: ${params.file}` }], isError: true, details: { file: params.file, exists: false } };
  }

  const source = await fs.readFile(filePath, "utf-8");
  const lines = source.split('\n').length;
  const language = detectLanguage(params.file);

  // Dynamic import of parser
  const parser = require('@typescript-eslint/parser');
  const { parse } = parser;

  let ast;
  try {
    ast = parse(source, { sourceType: "module", ecmaVersion: "latest", ts: true, jsx: true });
  } catch (err: any) {
    return { content: [{ type: "text" as const, text: `Parse error: ${err.message}` }], isError: true, details: { file: params.file, error: err.message } };
  }

  // Analyze
  let functions = 0;
  let cyclomatic = 0;
  const halsteadCounts: HalsteadCounts = { operators: new Map(), operands: new Map() };

  walk(ast, (node: any) => {
    if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
      functions++;
      // Each function adds 1 to cyclomatic complexity base
      cyclomatic++;
      // Add decisions inside function body
      if (node.body) {
        cyclomatic += countDecisions(node.body);
      }
    }
  });

  // Collect Halstead across entire file
  collectHalstead(ast, halsteadCounts);
  const halstead = computeHalstead(halsteadCounts);
  const maintainability = computeMaintainabilityIndex(halstead.volume, cyclomatic, lines);

  const result: ComplexityResult = {
    file: params.file,
    exists: true,
    language,
    lines,
    functions,
    cyclomatic,
    halstead: {
      volume: halstead.volume,
      difficulty: halstead.difficulty,
      effort: halstead.effort,
      bugs: halstead.bugs
    },
    maintainability: Math.round(maintainability * 10) / 10
  };

  const output = formatOutput(result);
  return { content: [{ type: "text" as const, text: output }], isError: false, details: result };
}

function detectLanguage(filename: string): "ts" | "tsx" | "js" | "jsx" | "unknown" {
  if (filename.endsWith('.tsx')) return 'tsx';
  if (filename.endsWith('.ts')) return 'ts';
  if (filename.endsWith('.jsx')) return 'jsx';
  if (filename.endsWith('.js')) return 'js';
  return 'unknown';
}

function formatOutput(r: ComplexityResult): string {
  return `
📄 File: ${r.file}
📏 Lines: ${r.lines}
🔤 Language: ${r.language}
📦 Functions: ${r.functions}

🌀 Cyclomatic Complexity: ${r.cyclomatic} (${complexityRating(r.cyclomatic)})

📊 Halstead Metrics:
   Volume: ${r.halstead.volume.toFixed(0)}
   Difficulty: ${r.halstead.difficulty.toFixed(0)}
   Effort: ${r.halstead.effort.toFixed(0)}
   Estimated Bugs: ${r.halstead.bugs.toFixed(3)}

🛠️ Maintainability Index: ${r.maintainability} (${miRating(r.maintainability)})
`.trim();
}

function complexityRating(cc: number): string {
  if (cc <= 10) return 'Low (simple)';
  if (cc <= 20) return 'Moderate';
  if (cc <= 50) return 'High (complex)';
  return 'Very High (risky)';
}

function miRating(mi: number): string {
  if (mi >= 85) return 'Excellent';
  if (mi >= 65) return 'Good';
  if (mi >= 40) return 'Fair';
  return 'Poor';
}
