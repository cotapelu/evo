#!/usr/bin/env node
/**
 * DEMO: Run first evolution cycle
 */

import { EvoSystem } from './dist/src/system.js';

async function runDemo() {
  console.log('🧬 EVOLUTION DEMO - First Cycle\n');
  console.log('=' .repeat(60));

  const system = EvoSystem.getInstance();

  try {
    console.log('\n1. Initializing system...');
    await system.initialize();
    console.log('   ✅ Initialized');
  } catch (e) {
    console.error('   ❌ Init failed:', e.message);
    process.exit(1);
  }

  const engine = system.getEvolutionEngine();
  if (!engine) {
    console.error('❌ EvolutionEngine not available');
    process.exit(1);
  }

  // Show current config
  console.log('\n2. Configuration:');
  const config = engine['config'];
  console.log(`   - Model: ${config?.model || 'default'}`);
  console.log(`   - Thinking level: ${config?.thinkingLevel || 'medium'}`);
  console.log(`   - Auto-apply: ${config?.autoApply}`);
  console.log(`   - Strategy: ${engine['selectedStrategyName']}`);

  // Run ONE cycle
  console.log('\n3. Running evolution cycle...');
  console.log('   (This may take 30-60 seconds depending on LLM response)\n');

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
      console.log(`   - Diff length: ${latest.diff ? latest.diff.length : 0} chars`);
    } else {
      console.log('\n📭 No improvements applied yet (LLM did not suggest any)');
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('\n✅ Demo complete!\n');
    console.log('Next steps:');
    console.log('  1. Check logs: tail -f ~/.pi/agent/evo.log');
    console.log('  2. View full history: /evolution-history (in TUI)');
    console.log('  3. Start auto daemon: /evolution start 300000');
    console.log('  4. Web UI: /web-ui-start 3000\n');
    
  } catch (e) {
    console.error('\n❌ Cycle failed:', e.message);
    console.log('\nCheck ~/.pi/agent/evo.log for details\n');
  }

  await system.shutdown();
}

runDemo().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
