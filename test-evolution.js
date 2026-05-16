#!/usr/bin/env node
/**
 * Manual evolution test - dry run to verify pipeline
 * Usage: npm run test:evolution
 */

import { EvoSystem } from './src/system.js';
import { Logger } from './src/logger.js';

async function testEvolution() {
  console.log('🧪 Starting Evolution Test...\n');

  // Initialize system
  const system = EvoSystem.getInstance();
  
  try {
    await system.initialize();
    console.log('✅ System initialized');
  } catch (e: any) {
    console.error('❌ Initialization failed:', e.message);
    process.exit(1);
  }

  const engine = system.getEvolutionEngine();
  if (!engine) {
    console.error('❌ Evolution engine not available');
    process.exit(1);
  }

  // Run ONE cycle (not auto)
  console.log('\n🔁 Running single evolution cycle...\n');
  
  try {
    const result = await engine.cycle();
    
    if (result) {
      console.log('\n✅ Evolution cycle succeeded!');
      const metrics = await engine.getMetrics();
      console.log(`   Level: ${metrics.totalCycles}`);
      console.log(`   Success rate: ${metrics.successRate.toFixed(1)}%`);
    } else {
      console.log('\n⚠️ Evolution cycle completed but no improvements made');
    }
  } catch (e: any) {
    console.error('\n❌ Evolution cycle failed:', e.message);
    process.exit(1);
  }

  // Show history
  const history = await engine.getHistory();
  console.log(`\n📚 History entries: ${history.length}`);
  if (history.length > 0) {
    const latest = history[history.length - 1];
    console.log(`   Latest: Level ${latest.level}`);
    console.log(`   Improvement: ${latest.improvement.substring(0, 80)}...`);
    console.log(`   Files: ${latest.affectedFiles?.join(', ') || 'N/A'}`);
  }

  // Show metrics
  const metrics = await engine.getMetrics();
  console.log('\n📊 Metrics:');
  console.log(`   Total cycles: ${metrics.totalCycles}`);
  console.log(`   Successful: ${metrics.successfulCycles}`);
  console.log(`   Failed: ${metrics.failedCycles}`);
  console.log(`   Avg cycle time: ${(metrics.avgCycleTimeMs / 1000).toFixed(2)}s`);

  console.log('\n✅ Test complete!');
  await system.shutdown();
}

testEvolution().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
