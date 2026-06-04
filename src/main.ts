/**
 * Evo Agent - Self-Evolving AI Agent System
 *
 * Main entry point. Initializes the runtime and starts interactive mode.
 */

import { createAndRunRuntime, printBanner, printDiagnostics, printStartupMetrics } from './runtime/runtime-provider.js';
import { InteractiveMode } from '@earendil-works/pi-coding-agent';

export async function main(): Promise<void> {
  printBanner();
  console.log('🚀 Initializing...');

  try {
    const { runtime, diagnostics, metrics } = await createAndRunRuntime();

    // Display startup info
    printDiagnostics(diagnostics);
    printStartupMetrics(metrics);

    // Start interactive mode
    const mode = new InteractiveMode(runtime);
    await mode.run();
  } catch (error) {
    console.error('\n❌ Fatal Error:');
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}


