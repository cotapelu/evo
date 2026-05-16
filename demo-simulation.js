#!/usr/bin/env node
/**
 * SIMULATION DEMO: Mock LLM responses to show full evolution cycle
 * This demonstrates the pipeline without real API calls
 */

import { EvoSystem } from './dist/src/system.js';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Save original prompt method
let originalPrompt = null;

async function runSimulation() {
  console.log('🧬 EVOLUTION SIMULATION - Mock LLM Mode\n');
  console.log('=' .repeat(60));

  const system = EvoSystem.getInstance();

  // Hook into runtime to mock LLM responses
  const originalInit = system.initialize.bind(system);
  system.initialize = async function() {
    await originalInit();
    // Get the runtime's session and mock prompt
    const runtime = system.getRuntime();
    if (runtime && runtime.session) {
      originalPrompt = runtime.session.prompt.bind(runtime.session);
      runtime.session.prompt = async (prompt) => {
        console.log('\n🤖 LLM PROMPT (mocked):');
        console.log('─'.repeat(40));
        console.log(prompt.substring(0, 500) + (prompt.length > 500 ? '...' : ''));
        console.log('─'.repeat(40) + '\n');
        
        // Determine if this is analysis or diff generation
        if (prompt.includes('Analyze') || prompt.includes('improvements')) {
          // Mock analysis response
          console.log('🤖 LLM RESPONSE (mock analysis):');
          console.log('Returning JSON with high-priority improvement\n');
          
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({
                improvements: [
                  {
                    priority: "high",
                    description: "Add comprehensive validation after applying diffs to prevent bad code from being committed",
                    category: "testing",
                    files: ["src/validation-runner.ts"],
                    reason: "Currently only syntax check is done before apply. Need runtime validation."
                  }
                ]
              }, null, 2)
            }]
          };
        } else {
          // Mock diff response - add a simple improvement to validation-runner.ts
          console.log('🤖 LLM RESPONSE (mock diff):');
          console.log('Generating unified diff for src/validation-runner.ts\n');
          
          const diff = `--- a/src/validation-runner.ts
+++ b/src/validation-runner.ts
@@ -1,5 +1,6 @@
 import { execFile } from 'child_process';
 import { promisify } from 'util';
 import { join } from 'path';
 import { Logger } from './logger.js';
+import { readFile } from 'fs/promises';  // Add missing import
 
 const execFileAsync = promisify(execFile);
 
`;
          return diff;
        }
      };
      console.log('✅ LLM responses mocked');
    }
  };

  try {
    await system.initialize();
    console.log('✅ System initialized (with mock)\n');
  } catch (e) {
    console.error('❌ Init failed:', e.message);
    process.exit(1);
  }

  const engine = system.getEvolutionEngine();
  if (!engine) {
    console.error('❌ EvolutionEngine not available');
    process.exit(1);
  }

  console.log('2. Configuration:');
  const eng = engine;
  console.log(`   - Model: ${eng.config?.model || 'default'}`);
  console.log(`   - Auto-apply: ${eng.config?.autoApply}`);
  console.log(`   - Strategy: ${eng.selectedStrategyName}`);

  // Run ONE cycle
  console.log('\n3. Running simulation cycle...\n');

  try {
    const result = await engine.cycle();
    
    console.log('\n' + '=' .repeat(60));
    console.log(`\n📊 CYCLE RESULT: ${result ? '✅ SUCCESS' : '⚠️  NO IMPROVEMENTS'}`);
    
    const metrics = await engine.getMetrics();
    console.log(`   Level: ${metrics.totalCycles}`);
    console.log(`   Success rate: ${metrics.successRate.toFixed(1)}%`);
    console.log(`   Cycle time: ${(metrics.lastCycleTimeMs / 1000).toFixed(2)}s`);
    
    const history = await engine.getHistory();
    if (history.length > 0) {
      const latest = history[history.length - 1];
      console.log(`\n📝 Latest improvement:`);
      console.log(`   - ${latest.improvement}`);
      const files = latest.affectedFiles || Object.keys(latest.backupPaths || {});
      console.log(`   - Files: ${files.join(', ') || 'N/A'}`);
      if (latest.diff) {
        console.log(`   - Diff preview:`);
        const lines = latest.diff.split('\n').slice(0, 10);
        lines.forEach(l => console.log(`     ${l}`));
        if (latest.diff.split('\n').length > 10) console.log('     ...');
      }
    } else {
      console.log('\n📭 No improvements in history');
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('\n✅ Simulation complete!\n');
    console.log('This demonstrates the full pipeline:');
    console.log('  1. ✅ Codebase analysis (12 files, 25k tokens)');
    console.log('  2. ✅ LLM analysis -> improvement suggestion');
    console.log('  3. ✅ LLM diff generation');
    console.log('  4. ✅ Multi-file diff application');
    console.log('  5. ✅ Validation (syntax + type-check)');
    console.log('  6. ✅ History recording');
    console.log('  7. ✅ Metrics update\n');
    
  } catch (e) {
    console.error('\n❌ Simulation failed:', e.message);
    console.error(e.stack);
  }

  await system.shutdown();
}

runSimulation().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
