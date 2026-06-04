/**
 * Evo Agent - Self-Evolving AI Agent System
 *
 * Main entry point. Initializes the runtime and starts interactive mode.
 */

import { createAndRunRuntime, printBanner, printDiagnostics, printStartupMetrics } from './runtime/runtime-provider.js';
import { InteractiveModeProvider, type InteractiveModeOptions } from './interactive/interactive-provider.js';
import type { ImageContent } from '@earendil-works/pi-ai';

export async function main(): Promise<void> {
  printBanner();
  console.log('🚀 Initializing...');

  try {
    const { runtime, diagnostics, metrics } = await createAndRunRuntime();

    // Display startup info
    printDiagnostics(diagnostics);
    printStartupMetrics(metrics);

    // Create and start interactive mode via provider with options
    const provider = new InteractiveModeProvider(runtime);
    const options: InteractiveModeOptions = {
      // Enable verbose mode to show detailed startup information
      verbose: true,
      // You can add other options here:
      // initialMessage?: string;
      // initialImages?: ImageContent[];
      // initialMessages?: string[];
      // migratedProviders?: string[];
      // modelFallbackMessage?: string;
    };
    await provider.run(options);
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


