// ast-transformer.ts - Aggressive AST-based Code Transformation (Iteration 112)
// Parses, analyzes, and modifies TypeScript code automatically

export interface TransformationResult {
  success: boolean;
  originalCode: string;
  transformedCode: string;
  changes: string[];
  errors: string[];
}

export class ASTTransformer {
  // Aggressive thresholds (Iteration 112)
  private readonly COMPLEXITY_THRESHOLD = 3; // Lower from 5
  private readonly METHOD_LENGTH_THRESHOLD = 30; // Lower from 40
  private readonly MIN_LINE_DIFF = 20; // Lower from 20 (keep)
  private readonly AGGRESSIVE_ITERATIONS = 10; // After iteration 10

  // Transformations log
  private transformations: string[] = [];

  async analyzeAndTransform(code: string, iterationCount: number): Promise<TransformationResult> {
    let newCode = code;
    const changes: string[] = [];

    // Only aggressive after iteration 10
    const aggressive = iterationCount >= this.AGGRESSIVE_ITERATIONS;

    // 1. Complexity-based extraction
    const complexity = this.estimateComplexity(newCode);
    if (complexity >= this.COMPLEXITY_THRESHOLD || aggressive) {
      const extracted = await this.transformAggressiveExtract(newCode, aggressive ? 2 : 1);
      if (extracted.success) {
        newCode = extracted.transformedCode;
        changes.push(...extracted.changes);
      }
    }

    // 2. Duplication detection
    if (aggressive) {
      const dedupResult = this.transformDeduplication(newCode);
      if (dedupResult.success) {
        newCode = dedupResult.transformedCode;
        changes.push(...dedupResult.changes);
      }
    }

    // 3. Conditional simplification
    if (aggressive) {
      const simpleResult = this.transformSimpleConditionals(newCode);
      if (simpleResult.success) {
        newCode = simpleResult.transformedCode;
        changes.push(...simpleResult.changes);
      }
    }

    return {
      success: changes.length > 0,
      originalCode: code,
      transformedCode: newCode,
      changes,
      errors: []
    };
  }

  private async transformAggressiveExtract(code: string, maxExtractions: number): Promise<TransformationResult> {
    const lines = code.split('\n');
    const changes: string[] = [];
    let newCode = code;
    let extractions = 0;

    // Find long private async methods
    for (let i = 0; i < lines.length && extractions < maxExtractions; i++) {
      const line = lines[i];
      // Match:   private async methodName(...)
      const match = line.match(/^\s*private\s+async\s+(\w+)\s*\(/);
      if (match) {
        const methodName = match[1];
        const startLine = i + 1;
        // Find end of method (closing brace at same indent)
        let braceCount = 0;
        let endLine = startLine;
        for (let j = startLine; j < lines.length; j++) {
          const l = lines[j];
          braceCount += (l.match(/{/g) || []).length;
          braceCount -= (l.match(/}/g) || []).length;
          if (braceCount <= 0 && j > startLine) {
            endLine = j;
            break;
          }
        }
        const length = endLine - startLine + 1;
        if (length > this.METHOD_LENGTH_THRESHOLD) {
          // Extract
          const result = this.transformExtractMethod(code, `${methodName}_extracted_${Date.now()}`, startLine, endLine);
          if (result.success) {
            newCode = result.transformedCode;
            changes.push(`Extracted method ${methodName} (${length} lines)`);
            extractions++;
            // Re-parse lines for next iteration
            lines.length = 0;
            lines.push(...newCode.split('\n'));
          }
        }
      }
    }

    return { success: extractions > 0, originalCode: code, transformedCode: newCode, changes, errors: [] };
  }

  private transformDeduplication(code: string): TransformationResult {
    const changes: string[] = [];
    let newCode = code;

    // Simple duplicate line detection (consecutive similar lines)
    const lines = code.split('\n');
    for (let i = 0; i < lines.length - 2; i++) {
      const l1 = lines[i].trim();
      const l2 = lines[i+1].trim();
      const l3 = lines[i+2].trim();
      if (l1 && l2 && l3 && l1 === l2 && l2 === l3) {
        // Remove duplicates after first occurrence
        let j = i + 2;
        while (j < lines.length && lines[j].trim() === l1) {
          lines[j] = '// DUPLICATE REMOVED';
          j++;
        }
        changes.push(`Removed duplicate block (${j - i - 1} lines)`);
      }
    }

    newCode = lines.join('\n');
    return { success: changes.length > 0, originalCode: code, transformedCode: newCode, changes, errors: [] };
  }

  private transformSimpleConditionals(code: string): TransformationResult {
    const changes: string[] = [];
    let newCode = code;

    // Simplify: if (x) { return y; } else { return z; } → return x ? y : z
    const regex = /if\s*\(\s*(\w+)\s*\)\s*\{\s*return\s+(\w+)\s*;\s*\}\s*else\s*\{\s*return\s+(\w+)\s*;\s*\}/g;
    if (regex.test(newCode)) {
      newCode = newCode.replace(regex, 'return $1 ? $2 : $3;');
      changes.push('Simplified conditional ternary');
    }

    // Simplify double negatives
    const negRegex = /if\s*\(\s*!\s*(\w+)\s*\)\s*\{\s*return\s+false\s*;\s*\}\s*return\s+true\s*;/g;
    if (negRegex.test(newCode)) {
      newCode = newCode.replace(negRegex, 'return !!$1;');
      changes.push('Simplified boolean logic');
    }

    return { success: changes.length > 0, originalCode: code, transformedCode: newCode, changes, errors: [] };
  }

  // Existing methods (kept for compatibility)
  transformAddFeature(code: string, feature: string, implementation: string): TransformationResult {
    const changes: string[] = [];
    let newCode = code;

    const importStatement = this.generateImportStatement(feature, implementation);
    if (!this.hasImport(newCode, feature) && implementation.includes('export')) {
      newCode = this.addImport(newCode, importStatement);
      changes.push(`Added import for ${feature}`);
    }

    if (!newCode.includes(`'${feature}'`) && !newCode.includes(`"${feature}"`)) {
      newCode = this.addCapability(newCode, feature);
      changes.push(`Added capability '${feature}'`);
    }

    if (implementation && !newCode.includes(implementation.substring(0, 50))) {
      newCode = this.insertImplementation(newCode, implementation);
      changes.push(`Inserted implementation for ${feature}`);
    }

    return { success: true, originalCode: code, transformedCode: newCode, changes, errors: [] };
  }

  transformRefactor(code: string, pattern: string, replacement: string): TransformationResult {
    const changes: string[] = [];
    let newCode = code;
    let count = 0;

    const regex = new RegExp(pattern, 'g');
    if (regex.test(newCode)) {
      newCode = newCode.replace(regex, replacement);
      count = (newCode.match(regex) || []).length;
      changes.push(`Refactored pattern → (${count} occurrences)`);
    }

    return { success: true, originalCode: code, transformedCode: newCode, changes, errors: count > 0 ? [] : ['No matches'] };
  }

  transformExtractMethod(code: string, methodName: string, startLine: number, endLine: number): TransformationResult {
    const lines = code.split('\n');
    const changes: string[] = [];

    if (startLine < 1 || endLine > lines.length || startLine >= endLine) {
      return { success: false, originalCode: code, transformedCode: code, changes: [], errors: ['Invalid line range'] };
    }

    const methodLines = lines.slice(startLine - 1, endLine);
    const methodBody = methodLines.map(l => '  ' + l).join('\n');
    const newMethod = `  private async ${methodName}(): Promise<void> {\n${methodBody}\n  }`;

    lines.splice(startLine - 1, endLine - startLine + 1, `// Extracted to ${methodName}()`);

    const classPos = lines.findIndex(l => l.includes('export class EvoAgent'));
    if (classPos > -1) {
      lines.splice(classPos + 2, 0, newMethod);
      changes.push(`Extracted lines ${startLine}-${endLine} to ${methodName}`);
    } else {
      return { success: false, originalCode: code, transformedCode: code, changes: [], errors: ['No class found'] };
    }

    return { success: true, originalCode: code, transformedCode: lines.join('\n'), changes, errors: [] };
  }

  transformAddTest(code: string, testName: string, testBody: string): TransformationResult {
    const testTemplate = `  test('${testName}', async () => {\n${testBody}\n  });\n`;
    let newCode = code;

    const lastTestPos = code.lastIndexOf('test(');
    if (lastTestPos > -1) {
      const nextLineEnd = code.indexOf('\n', lastTestPos);
      if (nextLineEnd > -1) {
        newCode = code.substring(0, nextLineEnd + 1) + testTemplate + code.substring(nextLineEnd + 1);
      }
    }

    return { success: true, originalCode: code, transformedCode: newCode, changes: [`Test: ${testName}`], errors: [] };
  }

  // Helpers
  private hasImport(code: string, feature: string): boolean {
    const variations = [`import.*${feature}`, `from.*${feature}`];
    return variations.some(p => new RegExp(p).test(code));
  }

  private generateImportStatement(feature: string, implementation: string): string {
    if (implementation.includes('from \'./')) {
      return implementation.match(/import.*from.*/)?.[0] || `import { ${feature} } from './src/${feature}.js';`;
    }
    return `import { ${feature} } from './src/${feature}.js';`;
  }

  private addImport(code: string, importStmt: string): string {
    const lastImport = code.lastIndexOf('import');
    if (lastImport > -1) {
      const importEnd = code.indexOf('\n', lastImport);
      return code.substring(0, importEnd + 1) + importStmt + '\n' + code.substring(importEnd + 1);
    }
    return importStmt + '\n' + code;
  }

  private addCapability(code: string, capability: string): string {
    const capPattern = /capabilities:\s*\[([^\]]*)\]/;
    return code.replace(capPattern, (match, p1) => {
      if (!p1.includes(`'${capability}'`) && !p1.includes(`"${capability}"`)) {
        return `capabilities: [${p1.trim()}, '${capability}']`;
      }
      return match;
    });
  }

  private insertImplementation(code: string, implementation: string): string {
    const classPos = code.indexOf('export class EvoAgent');
    if (classPos > -1) {
      const classLineEnd = code.indexOf('{', classPos);
      if (classLineEnd > -1) {
        const indent = '  ';
        const implWithIndent = implementation.split('\n').map(l => indent + l).join('\n');
        return code.substring(0, classLineEnd + 1) + implWithIndent + '\n' + code.substring(classLineEnd + 1);
      }
    }
    return code + '\n' + implementation;
  }

  estimateComplexity(code: string): number {
    const lines = code.split('\n').length;
    const cyclomatic = (code.match(/\b(if|for|while|catch|switch)\b/g) || []).length + 1;
    const nesting = (code.match(/\{\s*\n/g) || []).length; // Rough
    return Math.max(lines / 100, cyclomatic / 5, nesting / 5);
  }

  analyzeComplexity(code: string): { lines: number; cyclomatic: number; warnings: string[] } {
    const lines = code.split('\n').length;
    const cyclomatic = (code.match(/\b(if|for|while|catch|switch)\b/g) || []).length + 1;
    const warnings: string[] = [];

    if (lines > 500) warnings.push('Code exceeds 500 lines - consider modularization');
    if (cyclomatic > 15) warnings.push('High cyclomatic complexity - consider extracting methods');
    if ((code.match(/TODO|FIXME|XXX/g) || []).length > 0) warnings.push('Contains TODO/FIXME comments');

    return { lines, cyclomatic, warnings };
  }
}
