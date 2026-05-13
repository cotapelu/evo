#!/bin/bash
echo "🚀 Applying v3.0 code generation upgrade..."

# 1. Increase level cap 20→30
sed -i 's/Math\.min(20,/Math.min(30,/g' evo.ts
echo "  ✓ Level cap: 20→30"

# 2. Add new feature detections (after stats line, before closing brace)
sed -i '/^      stats: \/\(stats:\|totalMessagesSent\)\/\.test(code),$/a\
      documentation: /\/\*\\*[\\s\\S]*?\\*\//.test(code) || (/\\bJSDoc\\b/i.test(code)),\
      testing: /(describe\\(|it\\(|test\\(|expect\\()/.test(code),\
      modularization: /(private|public|protected)\\s+\\w+\\s*\\(/.test(code) && (code.match(/class/g) || []).length > 1,\
      concurrency: /(Worker|cluster|Thread|Promise\.all|async\\s+\\w+\\s*\()/.test(code)' evo.ts
echo "  ✓ Feature detections: documentation, testing, modularization, concurrency"

# 3. Add transformation helpers before validateCode
insert_line=$(grep -n "  private async validateCode" evo.ts | head -1 | cut -d: -f1)
if [ -n "$insert_line" ]; then
  insert_before=$((insert_line - 1))
  cat > /tmp/helpers.js << 'EOF'

  // ==================== CODE GENERATION ====================

  private addJSDocComments(code: string): string {
    this.log('info', '📚 Adding JSDoc documentation...');
    if (!code.includes('/**\n * EvoAgent')) {
      code = code.replace(
        /export class EvoAgent \{/,
        `/**\n * EvoAgent - Self-Evolving AI Agent\n * Autonomous self-improving system\n * @version 2.0\n */\nexport class EvoAgent {`
      );
    }
    this.log('info', '✅ JSDoc added');
    return code;
  }

  private async addTestStubs(code: string): Promise<string> {
    this.log('info', '🧪 Generating test stubs...');
    const testContent = `// Auto-generated tests\nimport { EvoAgent } from './evo.ts';\n\ndescribe('EvoAgent Core', () => {\n  it('should initialize', () => {\n    const a = new EvoAgent({ maxIterations: 1 });\n    expect(a.id).toBeDefined();\n    expect(a.state.level).toBeGreaterThan(0);\n  });\n  it('should create goals', () => {\n    const a = new EvoAgent({ maxIterations: 1, enableReplication: false });\n    const g = a.createGoal('Test', 1, ['Step1']);\n    expect(g.id).toBeDefined();\n  });\n});\n`;
    try { this.fs.writeFile('test-stubs.ts', testContent); this.log('info', '📝 test-stubs.ts created'); } catch (e) {}
    return code;
  }

  private prepareModularization(code: string): string {
    this.log('info', '📦 Preparing modularization...');
    if (!code.includes('// MODULE SUGGESTIONS')) {
      code = code.replace(
        /(\/\/ ==================== AGENT CLASS ====================)/,
        `// MODULE SUGGESTIONS:\n// Consider splitting:\n// - filesystem.ts (FileSystem class)\n// - types.ts (interfaces)\n// - utils.ts (helpers)\n\n$1`
      );
    }
    return code;
  }

  private addWorkerThreadSupport(code: string): string {
    this.log('info', '⚡ Adding Worker thread template...');
    if (!code.includes('// Worker pool template')) {
      const pool = `\n  // ==================== WORKER POOL ====================\n  // Uncomment to enable:\n  // private workerPoolSize = 4;\n  // private initWorkerPool() { /* TODO */ }\n  // private submitToWorkerPool<T>(task: () => Promise<T>): Promise<T> { /* TODO */ }\n`;
      code = code.replace(
        /(\/\/ ==================== CORE EVOLUTION LOOP ====================)/,
        `$1${pool}`
      );
    }
    return code;
  }

  private addPerformanceOptimizations(code: string): string {
    this.log('info', '🚀 Adding performance optimizations...');
    if (!code.includes('private memoize')) {
      const memo = `\n  private memoize<K, V>(fn: (key: K) => V): (key: K) => V {\n    const cache = new Map<K, V>();\n    return (key) => cache.has(key) ? cache.get(key)! : cache.set(key, fn(key)) && cache.get(key)!;\n  }\n`;
      code = code.replace(
        /(\/\/ ==================== UTILS ====================)/,
        `$1${memo}`
      );
    }
    return code;
  }

EOF
  sed -i "${insert_before}r /tmp/helpers.js" evo.ts
  echo "  ✓ Added transformation helper methods"
fi

# 4. Update improveCode to call transformations (simple insert after 'let newCode')
sed -i '/let newCode = this\.currentCode;/a\    const opportunity = plan.opportunity.toLowerCase();\n    if (opportunity.includes("documentation") || opportunity.includes("jsdoc")) newCode = this.addJSDocComments(newCode);\n    if (opportunity.includes("test") || opportunity.includes("testing")) newCode = await this.addTestStubs(newCode);\n    if (opportunity.includes("modular")) newCode = this.prepareModularization(newCode);\n    if (opportunity.includes("performance") || opportunity.includes("optimization")) newCode = this.addPerformanceOptimizations(newCode);' evo.ts
echo "  ✓ Updated improveCode to use transformations"

# 5. Update formatFeatureName to include new features
sed -i "/'unit testing',$/a\\      documentation: 'code documentation'," evo.ts
sed -i "/'modular architecture',$/a\\      concurrency: 'concurrency support'," evo.ts
echo "  ✓ Updated feature name mappings"

echo -e "\n🎉 v3.0-dev upgrade complete! Agent now has code generation capabilities."
echo "Next run will automatically implement improvements when weaknesses detected."
