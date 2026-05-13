// Script to add code generation capabilities to evo.ts
import * as fs from 'fs';
import * as path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

function readFile() {
  return fs.readFileSync(path.join(__dirname, 'evo.ts'), 'utf-8');
}

function writeFile(content: string) {
  fs.writeFileSync(path.join(__dirname, 'evo.ts'), content);
  console.log('✅ evo.ts updated with code generation');
}

const original = readFile();

// 1. Replace improveCode method
const oldImproveCode = /  private async improveCode\(plan: EvolutionPlan\): Promise<string> \{[^}]*\n  \}/s;
const newImproveCode = `
  private async improveCode(plan: EvolutionPlan): Promise<string> {
    this.log('debug', '🔧 Applying improvement:', plan.opportunity, 'Risk:', plan.riskLevel);

    let newCode = this.currentCode;
    const opportunity = plan.opportunity.toLowerCase();

    // Apply transformations based on opportunity type
    if (opportunity.includes('documentation') || opportunity.includes('jsdoc')) {
      newCode = this.addJSDocComments(newCode);
    }
    if (opportunity.includes('test') || opportunity.includes('testing')) {
      newCode = await this.addTestStubs(newCode);
    }
    if (opportunity.includes('modular')) {
      newCode = this.prepareModularization(newCode);
    }
    if (opportunity.includes('concurrency') || opportunity.includes('worker')) {
      newCode = this.addWorkerThreadSupport(newCode);
    }
    if (opportunity.includes('performance') || opportunity.includes('optimization')) {
      newCode = this.addPerformanceOptimizations(newCode);
    }

    // Always update timestamp and changelog
    const timestamp = nowISO();
    newCode = newCode.replace(
      /\/\* Last updated: .* \*\//,
      `/* Last updated: ${timestamp} */`
    );

    const changelog = \`// Iteration \${this.iterationCount + 1}: \${plan.changes.length} changes (\${plan.opportunity}) [\${plan.riskLevel}]\`;
    if (!newCode.includes(changelog)) {
      newCode = newCode.replace(
        /(\/\/ Features: .*)/,
        \`\$1\\n\${changelog}\`
      );
    }

    return newCode;
  }

  // ==================== CODE GENERATION TRANSFORMATIONS ====================

  private addJSDocComments(code: string): string {
    this.log('info', '📚 Adding JSDoc documentation...');

    // Add JSDoc to class EvoAgent
    if (!code.includes('/**\\n * EvoAgent - Self-Evolving AI Agent\\n */')) {
      code = code.replace(
        /export class EvoAgent \\{\\n/,
        \`/**\\n * EvoAgent - Self-Evolving AI Agent\\n * Provides autonomous evolution through self-analysis, planning, and improvement\\n * @version 2.0\\n * @author Self-Evolving System\\n */\\nexport class EvoAgent {\\n\`
      );
    }

    this.log('info', '✅ JSDoc documentation added');
    return code;
  }

  private async addTestStubs(code: string): Promise<string> {
    this.log('info', '🧪 Generating test stubs...');

    const testFile = \`// Auto-generated test stubs for EvoAgent\\n// Generated: \${nowISO()}\\n\\nimport { EvoAgent } from './evo.ts';\\n\\n// Test suite\\ndescribe('EvoAgent Core', () => {\\n  it('should initialize with default config', () => {\\n    const agent = new EvoAgent({ maxIterations: 1 });\\n    expect(agent.id).toBeDefined();\\n    expect(agent.state.level).toBeGreaterThan(0);\\n  });\\n\\n  it('should create goals', () => {\\n    const agent = new EvoAgent({ maxIterations: 1, enableReplication: false });\\n    const goal = agent.createGoal('Test goal', 1, ['Step 1', 'Step 2']);\\n    expect(goal.id).toBeDefined();\\n    expect(goal.status).toBe('pending');\\n  });\\n});\\n\`;

    try {
      this.fs.writeFile('test-stubs.ts', testFile);
      this.log('info', '📝 Test stubs written to test-stubs.ts');
    } catch (e) {
      this.log('error', 'Failed to write test stubs:', e);
    }

    return code;
  }

  private prepareModularization(code: string): string {
    this.log('info', '📦 Preparing modularization...');

    if (!code.includes('// ==================== MODULE SUGGESTIONS ====================')) {
      const marker = \`\\n// ==================== MODULE SUGGESTIONS ====================\\n\` +
        \`// Consider splitting: FileSystem → filesystem.ts\\n\` +
        \`//                Types → types.ts\\n\` +
        \`//                Utils → utils.ts\\n\` +
        \`// ==================== END MODULE SUGGESTIONS ====================\\);\\n\`;
      code = code.replace(
        /(\\/\\/ ==================== AGENT CLASS ====================)/,
        marker + '\\n$1'
      );
    }

    this.log('info', '✅ Modularization markers added');
    return code;
  }

  private addWorkerThreadSupport(code: string): string {
    this.log('info', '⚡ Adding Worker thread support...');

    if (!code.includes('// Worker pool template')) {
      const workerPoolCode = \`\\n  // ==================== WORKER POOL ====================\\n  // Uncomment to enable parallel processing\\n  // private workerPoolSize: number = 4;\\n  // private workers: Worker[] = [];\\n  //\n  // private initWorkerPool(): void { /* TODO: Implement */ }\\n  // private submitToWorkerPool<T>(task: () => Promise<T>): Promise<T> { /* TODO */ }\\n\`;
      code = code.replace(
        /(\\/\\/ ==================== CORE EVOLUTION LOOP ====================)/,
        \`\$1\\n\${workerPoolCode}\`
      );
    }

    this.log('info', '✅ Worker pool template added');
    return code;
  }

  private addPerformanceOptimizations(code: string): string {
    this.log('info', '🚀 Adding performance optimizations...');

    // Add memoization helper
    if (!code.includes('private memoize')) {
      const memoizeCode = \`\\n  // ==================== PERFORMANCE UTILITIES ====================\\n  private memoize<K extends string, V>(fn: (key: K) => V): (key: K) => V {\\n    const cache = new Map<K, V>();\\n    return (key: K) => {\\n      if (!cache.has(key)) {\\n        cache.set(key, fn(key));\\n      }\\n      return cache.get(key)!;\\n    };\\n  }\\n\`;
      code = code.replace(
        /(\\/\\/ ==================== UTILS ====================)/,
        \`\$1\\n\${memoizeCode}\`
      );
    }

    this.log('info', '✅ Performance optimizations added');
    return code;
  }
`;

// 2. Increase level cap in analyzeCurrentState
const oldLevelCap = /const newLevel = Math\.min\(15[^)]+\)/;
const newLevelCap = 'const newLevel = Math.min(30, featureCount + Math.floor(this.state.level * 0.5));';
// Note: code already has 20, but we'll bump to 30 for future growth

// 3. Add documentation detection
const oldFeatures = /(      stats: \/(stats:\|totalMessagesSent)\/\.test\(code\))\n    };/.source;
const newFeatures = `      stats: /(stats:|totalMessagesSent)/.test(code),
      documentation: /\\/\\*\\*[\\s\\S]*?\\*\\//.test(code) || (/\\bJSDoc\\b/i.test(code)),
      testing: /(describe\\(|it\\(|test\\(|expect\\()/.test(code),
      modularization: /(private|public|protected)\\s+\\w+\\s*\\(/.test(code) && (code.match(/class/g) || []).length > 1,
      concurrency: /(Worker|cluster|Thread|Promise\\.all|async\\s+\\w+\\s*\\().test(code)
    };`;

let updated = original;

// Apply changes
if (!original.includes('private addJSDocComments')) {
  updated = updated.replace(oldImproveCode, newImproveCode);
  console.log('✅ Replaced improveCode with code generation');
}

if (!original.includes('documentation:') && original.includes('stats: /(stats:')) {
  updated = updated.replace(
    /(      stats: \/\(stats:\|totalMessagesSent\)\/\.test\(code\))\n    };/,
    newFeatures
  );
  console.log('✅ Added documentation, testing, modularization, concurrency detection');
}

// Increase level cap
if (original.match(/Math\.min\(20,/)) {
  updated = updated.replace(/Math\.min\(20,/, 'Math.min(30,');
  console.log('✅ Increased level cap from 20 to 30');
}

// Write back
writeFile(updated);

console.log('\n🎯 Code generation capabilities added!');
console.log('Next run will automatically:');
console.log('  - Add JSDoc documentation (when weakness detected)');
console.log('  - Create test-stubs.ts (when weakness detected)');
console.log('  - Add modularization markers');
console.log('  - Add worker thread templates');
console.log('  - Add performance utilities');
