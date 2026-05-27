/**
 * Evo Agent - Self-Evolving AI Agent System
 *
 * Main entry point. Initializes the runtime and starts interactive mode.
 */

import { createAndRunRuntime, printBanner, printDiagnostics, printStartupMetrics } from './runtime-provider.js';
import { runInteractiveMode, setupShutdownHandlers } from './interactive-provider.js';

export async function main(): Promise<void> {
  printBanner();
  console.log('🚀 Initializing...');

  try {
    const { runtime, diagnostics, metrics } = await createAndRunRuntime();

    // Setup shutdown handlers after runtime is ready
    setupShutdownHandlers();

    // Display startup info
    printDiagnostics(diagnostics);
    printStartupMetrics(metrics);

    // Start interactive mode
    await runInteractiveMode(runtime);
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


