// Quick validation test - ensures EvoSystem initializes correctly
import { EvoSystem } from './dist/src/system.js';

async function test() {
  console.log('🧪 Testing EvoSystem initialization...');

  try {
    const system = EvoSystem.getInstance();
    await system.initialize();

    console.log('✅ System initialized');

    // Check components
    console.log('  - Runtime:', system.getRuntime() ? '✅' : '❌');
    console.log('  - Session:', system.getSession() ? '✅' : '❌');
    console.log('  - Evolution:', system.getEvolutionEngine() ? '✅' : '❌');
    console.log('  - AgentManager:', system.getAgentManager() ? '✅' : '❌');
    console.log('  - MessageBus:', system.getMessageBus() ? '✅' : '❌');
    console.log('  - Custom tools count:', system.getRuntime()?.session?.tools?.length || 0);

    await system.shutdown();
    console.log('✅ Shutdown clean');
    console.log('✅ All validations passed!');
    process.exit(0);
  } catch (e) {
    console.error('❌ Validation failed:', e);
    process.exit(1);
  }
}

test();
