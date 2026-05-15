#!/usr/bin/env node

// evo.ts - Self-Evolving Agent System
// Full rewrite using @earendil-works/pi-coding-agent

import { EvoSystem } from './src/system.js';

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'interactive';

  const system = EvoSystem.getInstance();

  try {
    await system.initialize();
    await system.run(mode as any, args.slice(1));
  } catch (error: any) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGINT', async () => {
  await EvoSystem.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await EvoSystem.shutdown();
  process.exit(0);
});

process.on('uncaughtException', async (error: any) => {
  console.error('Uncaught exception:', error);
  await EvoSystem.shutdown();
  process.exit(1);
});

main();
