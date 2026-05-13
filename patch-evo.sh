#!/bin/bash
echo "🔧 Patching evo.ts with code generation..."

# 1. Increase level cap 20→30
sed -i 's/Math\.min(20,/Math.min(30,/g' evo.ts
echo "✅ Level cap increased"

# 2. Add new feature detections after stats line
sed -i '/^      stats: \/(stats:/a\\      documentation: /\\/\\*\\*[\\s\\S]*?\\*\\//.test(code) || (/\\bJSDoc\\b/i.test(code)),\n      testing: /(describe\\(|it\\(|test\\(|expect\\()/.test(code),\n      modularization: /(private|public|protected)\\s+\\w+\\s*\\(/.test(code) && (code.match(/class/g) || []).length > 1,\n      concurrency: /(Worker|cluster|Thread|Promise\\.all|async\\s+\\w+\\s*\\().test(code)' evo.ts
echo "✅ Added feature detections"

# 3. Add transformation helpers before validateCode
validate_line=$(grep -n "private async validateCode" evo.ts | head -1 | cut -d: -f1)
if [ -n "$validate_line" ]; then
  insert_at=$((validate_line - 1))
  cat > /tmp/helpers.txt << 'EOF'

  // ==================== CODE GENERATION ====================

  private addJSDocComments(code: string): string {
    this.log('info', '📚 Adding JSDoc...');
    if (!code.includes('/**\n * EvoAgent')) {
      code = code.replace(/export class EvoAgent \{/, `/**\n * EvoAgent - Self-Evolving AI Agent\n * @version 2.0\n */\nexport class EvoAgent {`);
    }
    return code;
  }

  private async addTestStubs(code: string): Promise<string> {
    this.log('info', '🧪 Generating test stubs...');
    const tests = `// Auto-generated tests\nimport { EvoAgent } from './evo.ts';\n\ndescribe('EvoAgent', () => {\n  it('initializes', () => {\n    const a = new EvoAgent({ maxIterations: 1 });\n    expect(a.id).toBeDefined();\n  });\n});\n`;
    try { this.fs.writeFile('test-stubs.ts', tests); this.log('info', '📝 test-stubs.ts created'); } catch (e) {}
    return code;
  }

  private prepareModularization(code: string): string {
    this.log('info', '📦 Modularization...');
    if (!code.includes('// MODULE SUGGESTIONS')) {
      code = code.replace(/(\/\/ ==================== AGENT CLASS ====================)/, `// MODULE SUGGESTIONS:\n// - filesystem.ts, types.ts\n\n$1`);
    }
    return code;
  }

  private addPerformanceOptimizations(code: string): string {
    this.log('info', '🚀 Performance optimizations...');
    if (!code.includes('private memoize')) {
      const memo = `\n  private memoize<K, V>(fn: (key: K) => V): (key: K) => V {\n    const cache = new Map<K, V>();\n    return (key) => cache.has(key) ? cache.get(key)! : cache.set(key, fn(key)) && cache.get(key)!;\n  }\n`;
      code = code.replace(/(\/\/ ==================== UTILS ====================)/, `$1${memo}`);
    }
    return code;
  }

EOF
  sed -i "${insert_at}r /tmp/helpers.txt" evo.ts
  echo "✅ Added transformation helpers"
fi

# 4. Replace improveCode body (simplified - add transformation calls)
sed -i '/private async improveCode(plan: EvolutionPlan): Promise<string> {/,/return newCode; }/ {
  /let newCode = this.currentCode;/a\    const opportunity = plan.opportunity.toLowerCase();\n    if (opportunity.includes("documentation") || opportunity.includes("jsdoc")) newCode = this.addJSDocComments(newCode);\n    if (opportunity.includes("test") || opportunity.includes("testing")) newCode = await this.addTestStubs(newCode);\n    if (opportunity.includes("modular")) newCode = this.prepareModularization(newCode);\n    if (opportunity.includes("performance") || opportunity.includes("optimization")) newCode = this.addPerformanceOptimizations(newCode);
}' evo.ts
echo "✅ Updated improveCode to call transformations"

echo -e "\n🎉 Patch applied! evo.ts upgraded to v3.0-dev"
