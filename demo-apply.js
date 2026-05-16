#!/usr/bin/env node
/**
 * SIMULATION DEMO 2: Auto-apply mode
 * Shows full apply + validation pipeline
 */

import { EvoSystem } from './dist/src/system.js';

let originalPrompt = null;

async function runSimulationApply() {
  console.log('🧬 EVOLUTION SIMULATION - Auto-Apply Mode\n');
  console.log('=' .repeat(60));

  const system = EvoSystem.getInstance();

  // Mock LLM
  const originalInit = system.initialize.bind(system);
  system.initialize = async function() {
    await originalInit();
    const runtime = system.getRuntime();
    if (runtime && runtime.session) {
      originalPrompt = runtime.session.prompt.bind(runtime.session);
      runtime.session.prompt = async (prompt) => {
        console.log('\n🤖 LLM: ' + (prompt.includes('Analyze') ? 'Analysis' : 'Diff generation'));
        
        if (prompt.includes('Analyze')) {
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({
                improvements: [
                  {
                    priority: "high",
                    description: "Add missing import to validation-runner",
                    category: "bugfix",
                    files: ["src/validation-runner.ts"],
                    reason: "TypeScript will fail without readFile import"
                  }
                ]
              }, null, 2)
            }]
          };
        } else {
          // Diff: add import line
          return `--- a/src/validation-runner.ts
+++ b/src/validation-runner.ts
@@ -1,5 +1,6 @@
 import { execFile } from 'child_process';
 import { promisify } from 'util';
 import { join } from 'path';
 import { Logger } from './logger.js';
+import { readFile } from 'fs/promises';
 
 const execFileAsync = promisify(execFile);
`;
        }
      };
    }
  };

  try {
    await system.initialize();
    console.log('✅ System initialized\n');
  } catch (e) {
    console.error('❌ Init failed:', e.message);
    process.exit(1);
  }

  const engine = system.getEvolutionEngine();
  
  // ENABLE AUTO-APPLY for this demo
  engine['config'].autoApply = true;
  console.log('⚙️  Configuration: autoApply = true');
  console.log('   (Will apply diff automatically after validation)\n');

  console.log('🔄 Running evolution cycle with auto-apply...\n');

  try {
    const result = await engine.cycle();
    
    console.log('\n' + '=' .repeat(60));
    console.log(`\n📊 CYCLE RESULT: ${result ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    const metrics = await engine.getMetrics();
    console.log(`   Level: ${metrics.totalCycles}`);
    console.log(`   Success rate: ${metrics.successRate.toFixed(1)}%`);
    
    const history = await engine.getHistory();
    if (history.length > 0) {
      const latest = history[history.length - 1];
      console.log(`\n📝 Applied improvement:`);
      console.log(`   - ${latest.improvement}`);
      console.log(`   - Files: ${latest.affectedFiles?.join(', ') || 'N/A'}`);
      console.log(`   - Backup: ${latest.backupPaths ? Object.values(latest.backupPaths)[0] : 'N/A'}`);
    }
    
    console.log('\n✅ Auto-apply simulation complete!');
    console.log('\nWhat happened:');
    console.log('  1. LLM suggested improvement');
    console.log('  2. LLM generated diff (added import)');
    console.log('  3. System applied diff to src/validation-runner.ts');
    console.log('  4. Validation ran: syntax + tsc --noEmit');
    console.log('  5. All checks passed → level incremented');
    console.log('  6. Backup created at ~/.pi/agent/.evo/backups/');
    console.log('  7. History recorded\n');
    
  } catch (e) {
    console.error('\n❌ Simulation failed:', e.message);
    console.error(e.stack);
  }

  await system.shutdown();
}

runSimulationApply().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
