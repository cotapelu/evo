/**
 * Evo Agent - Self-Evolving AI Agent System
 *
 * Main entry point với production-ready features:
 * - CLI argument parsing
 * - Signal handling (SIGINT, SIGTERM)
 * - Environment variable configuration
 * - Graceful shutdown
 * - Exit codes và metrics
 */

import { createAndRunRuntime, printBanner, printDiagnostics, printStartupMetrics } from './runtime/runtime-provider.js';
import { InteractiveModeProvider, type InteractiveModeOptions } from './interactive/interactive-provider.js';
import type { ImageContent } from '@earendil-works/pi-ai';
import { clearGlobalRuntime } from './runtime/runtime-runner.js';

/**
 * CLI arguments interface
 */
interface CliOptions {
  verbose: boolean;
  quiet: boolean;
  noInteractive: boolean;
  tools?: string[];
  thinkingLevel?: 'off' | 'low' | 'medium' | 'high';
  initialMessage?: string;
}

/**
 * Parse command-line arguments
 * Simple, dependency-free parser
 */
function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    verbose: false,
    quiet: false,
    noInteractive: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--quiet':
      case '-q':
        options.quiet = true;
        break;
      case '--no-interactive':
        options.noInteractive = true;
        break;
      case '--thinking-level':
        const level = args[++i];
        if (level && ['off', 'low', 'medium', 'high'].includes(level)) {
          options.thinkingLevel = level as any;
        } else {
          console.warn(`⚠️  Invalid thinking level: ${level}. Using default.`);
        }
        break;
      case '--tools':
        const tools = args[++i];
        if (tools) {
          options.tools = tools.split(',').map(t => t.trim());
        }
        break;
      case '--initial-message':
        options.initialMessage = args[++i];
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (!arg.startsWith('--')) {
          console.warn(`⚠️  Unknown argument: ${arg}`);
        }
    }
  }

  return options;
}

/**
 * Print help information
 */
function printHelp(): void {
  console.log('\n🧬 Evo Agent - Self-Evolving AI Agent System\n');
  console.log('Usage: evo [options]');
  console.log('\nOptions:');
  console.log('  -v, --verbose           Enable verbose logging');
  console.log('  -q, --quiet             Suppress non-essential output');
  console.log('  --no-interactive        Run in non-interactive mode (print mode only)');
  console.log('  --thinking-level LEVEL  Set thinking level: off, low, medium, high');
  console.log('  --tools TOOLS           Comma-separated list of tools to enable');
  console.log('  --initial-message MSG   Initial message to send to agent');
  console.log('  -h, --help              Show this help message');
  console.log('\nEnvironment Variables:');
  console.log('  EVO_VERBOSE             Same as --verbose');
  console.log('  EVO_QUIET               Same as --quiet');
  console.log('  EVO_THINKING_LEVEL      Default thinking level');
  console.log('\nExamples:');
  console.log('  evo --verbose --tools read,bash,edit');
  console.log('  evo --no-interactive --initial-message "List all files"');
}

/**
 * Get configuration từ environment variables
 */
function getEnvConfig(): Partial<CliOptions> {
  const config: Partial<CliOptions> = {};

  if (process.env.EVO_VERBOSE === '1' || process.env.EVO_VERBOSE === 'true') {
    config.verbose = true;
  }
  if (process.env.EVO_QUIET === '1' || process.env.EVO_QUIET === 'true') {
    config.quiet = true;
  }
  if (process.env.EVO_THINKING_LEVEL) {
    const level = process.env.EVO_THINKING_LEVEL as any;
    if (['off', 'low', 'medium', 'high'].includes(level)) {
      config.thinkingLevel = level;
    }
  }

  return config;
}

/**
 * Format final summary để hiển thị khi shutdown
 */
function printShutdownSummary(exitCode: number, uptimeMs: number): void {
  const seconds = (uptimeMs / 1000).toFixed(2);
  console.log('\n' + '='.repeat(50));
  console.log('🛑 Evo Agent Shutdown');
  console.log(`   Exit code: ${exitCode}`);
  console.log(`   Uptime: ${seconds}s`);
  console.log('='.repeat(50));
}

/**
 * Signal handler cho graceful shutdown
 */
let shutdownInProgress = false;

function setupSignalHandlers(provider: any, startTime: number): void {
  const handleShutdown = async (signal: string) => {
    if (shutdownInProgress) {
      console.log(`\n⚡ Forced shutdown (${signal})...`);
      process.exit(130); // 128 + SIGINT
    }

    shutdownInProgress = true;
    console.log(`\n🌙 Received ${signal}, shutting down gracefully...`);

    try {
      await provider.stop?.();
      clearGlobalRuntime();
      const uptimeMs = Date.now() - startTime;
      printShutdownSummary(0, uptimeMs);
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

/**
 * Main entry point
 */
export async function main(): Promise<void> {
  const startTime = Date.now();
  const cliOptions = parseCliArgs();
  const envConfig = getEnvConfig();
  const options: CliOptions = { ...envConfig, ...cliOptions };

  // Merge verbose/quiet flags
  if (process.env.EVO_VERBOSE) options.verbose = true;
  if (process.env.EVO_QUIET) options.quiet = true;

  if (!options.quiet) {
    printBanner();
    console.log('🚀 Initializing...');
    if (options.verbose) {
      console.log('📋 Configuration:');
      console.log(`   Thinking level: ${options.thinkingLevel ?? 'default'}`);
      console.log(`   Tools: ${options.tools?.join(', ') ?? 'all'}`);
      console.log(`   Interactive: ${!options.noInteractive}`);
    }
  }

  let provider: any = null;

  try {
    // Create runtime với options
    const runtimeOptions: any = {
      thinkingLevel: options.thinkingLevel,
      tools: options.tools,
      noExtensions: false,
      noSkills: false,
      noPromptTemplates: false,
      noThemes: false,
      noContextFiles: false,
      enableEventBus: true,
    };

    const { runtime, diagnostics, metrics } = await createAndRunRuntime(runtimeOptions);

    // Display startup info nếu không quiet
    if (!options.quiet) {
      printDiagnostics(diagnostics);
      printStartupMetrics(metrics);
    }

    // Create interactive mode provider với callbacks
    provider = new InteractiveModeProvider(runtime, {
      autoRetry: 1,
      fallbackToPrintMode: true,
      eventCallbacks: {
        onAgentStart: (event: any) => {
          if (options.verbose) {
            console.log('🤖 Agent started');
          }
        },
        onAgentEnd: (event: any) => {
          if (options.verbose) {
            console.log('✅ Agent completed task');
          }
        },
        onError: (error: Error) => {
          console.error('❌ Provider error:', error.message);
        },
      },
    });

    // Setup signal handlers trước khi run
    setupSignalHandlers(provider, startTime);

    // Determine nếu chạy interactive hay print mode
    const modeOptions: InteractiveModeOptions = {
      verbose: options.verbose,
    };

    if (options.initialMessage) {
      // Single-shot query: chạy print mode rồi exit
      if (!options.quiet) {
        console.log(`\n💬 Query: ${options.initialMessage}`);
      }
      await provider.runPrintMode(options.initialMessage, {
        verbose: options.verbose,
      });
      await provider.stop();
      const uptimeMs = Date.now() - startTime;
      if (!options.quiet) printShutdownSummary(0, uptimeMs);
      clearGlobalRuntime();
      process.exit(0);
    } else if (options.noInteractive) {
      // Non-interactive mode: thông báo và exit
      console.log('📄 Non-interactive mode enabled. Use --initial-message to execute a query.');
      await provider.stop();
      const uptimeMs = Date.now() - startTime;
      if (!options.quiet) printShutdownSummary(0, uptimeMs);
      clearGlobalRuntime();
      process.exit(0);
    } else {
      // Normal interactive mode
      await provider.run(modeOptions);
    }
  } catch (error) {
    const uptimeMs = Date.now() - startTime;

    // Determine exit code dựa trên error type
    let exitCode = 1;
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('enoent') || msg.includes('not found')) {
        exitCode = 2; // Configuration/File error
      } else if (msg.includes('eacces') || msg.includes('permission')) {
        exitCode = 3; // Permission error
      }
    }

    if (!options.quiet) {
      console.error('\n❌ Fatal Error:');
      console.error(`   ${error instanceof Error ? error.message : String(error)}`);
      if (options.verbose && error instanceof Error && error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
      printShutdownSummary(exitCode, uptimeMs);
    } else {
      // In quiet mode, chỉ in error message
      console.error(error instanceof Error ? error.message : String(error));
    }

    // Cleanup
    try {
      if (provider) await provider.stop();
      clearGlobalRuntime();
    } catch {
      // ignore cleanup errors
    }

    process.exit(exitCode);
  }
}


