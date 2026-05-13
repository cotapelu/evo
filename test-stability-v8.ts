import { EvoAgent } from './evo.ts';

console.log('🧪 ITERATION 8 STABILITY TEST - 100 iterations');
console.log('Config: maxMemory=500MB, level cap increased, capability expansion active\n');

const agent = new EvoAgent({
  maxIterations: 100,
  evolutionStrategy: 'balanced',
  enableReplication: true,
  maxChildren: 2,
  resourceLimits: { maxMemoryMB: 500 },
  logLevel: 'warn',
  deploy: { autoDeployOnStable: false }
});

const start = Date.now();

agent.run().then(() => {
  const totalTime = (Date.now() - start) / 1000;
  console.log('\n✅ STABILITY TEST COMPLETE');
  console.log('=============================');
  console.log('Time:', totalTime.toFixed(1), 's');
  console.log('Level:', agent.state.level);
  console.log('Capabilities:', agent.state.capabilities.length);
  console.log('Iterations:', agent.iterationCount);
  console.log('Children spawned:', agent.state.stats.totalChildrenSpawned);
  const last = agent.state.history[agent.state.history.length-1];
  if (last) {
    console.log('Memory avg:', last.performance.memoryUsage, 'MB');
    console.log('CPU total:', last.performance.cpuTime, 'ms');
  }
  console.log('Health:', agent.state.health.status);

  // List capabilities
  console.log('\n📋 Capabilities:', agent.state.capabilities.join(', '));

  // Check expansion candidates
  const missing = agent.detectMissingCapabilities ? agent.detectMissingCapabilities() : [];
  console.log('\n❓ Still missing:', missing.length, missing.join(', '));

  process.exit(0);
}).catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
