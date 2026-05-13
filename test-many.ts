import { EvoAgent } from './evo.ts';
console.log('=== LONG RUN TEST ===');
const agent = new EvoAgent({ maxIterations: 5, evolutionStrategy: 'balanced' });
agent.run().then(() => {
  console.log('Final state:', { level: agent.state.level, caps: agent.state.capabilities.length, goals: agent.state.goals.length });
  process.exit(0);
}).catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
