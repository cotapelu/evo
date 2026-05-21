/**
 * Interactive Mode Provider - Runs the interactive TUI mode
 *
 * Takes a ready AgentSessionRuntime and starts the interactive mode.
 * Handles graceful shutdown and error display.
 */

import { InteractiveMode } from '@earendil-works/pi-coding-agent';
import type { AgentSessionRuntime } from './runtime-provider.js';
// Import type-only from runtime-provider

export async function runInteractiveMode(runtime: AgentSessionRuntime): Promise<void> {
  try {
    console.log('✅ Ready');
    await new InteractiveMode(runtime, {}).run();
  } catch (error) {
    const elapsed = Date.now(); // Could track start time if needed
    console.error('\n❌ Interactive Mode Error:');
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Graceful shutdown handlers
export function setupShutdownHandlers(): void {
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down...');
    process.exit(0);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });
}
