// Simple test runner to check evo agent
import { EvoAgent } from './evo.ts';

console.log('=== EVO AGENT TEST RUN ===');

try {
  const agent = new EvoAgent({
    evolutionStrategy: 'balanced',
    maxIterations: 2, // Only run 2 iterations for test
    enableReplication: false,
    enableHealthChecks: true
  });

  console.log('Agent created:', agent.id);

  // Run agent with timeout
  const timeout = setTimeout(() => {
    console.log('Timeout reached, forcing shutdown');
    process.exit(0);
  }, 10000);

  agent.run().then(() => {
    console.log('Agent run completed normally');
    clearTimeout(timeout);
    process.exit(0);
  }).catch(err => {
    console.error('Agent run failed:', err);
    clearTimeout(timeout);
    process.exit(1);
  });

} catch (err) {
  console.error('Failed to start agent:', err);
  process.exit(1);
}
