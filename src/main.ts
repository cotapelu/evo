import {
  createAgentSessionRuntime,
  InteractiveMode,
  SessionManager,
  AuthStorage,
  createAgentSessionServices,
  createAgentSessionFromServices,
  getAgentDir,
  AgentSessionRuntime,
  AgentSessionServices,
  CreateAgentSessionResult,
  type ResourceDiagnostic,
  type AgentSessionRuntimeDiagnostic,
  type ExtensionFactory
} from '@earendil-works/pi-coding-agent';

// Import extensions aggregator (registers all extensions)
import extensionsAggregator from './extensions/index.js';

// ============================================
// GLOBAL CONSTANTS (reusable everywhere)
// ============================================
const APP_NAME = 'Evo Agent';
const VERSION = '0.0.1';

// ============================================
// GLOBAL VARIABLES (can be reused later)
// ============================================
let cwd: string;
let agentDir: string;
let sessionManager: SessionManager;
let authStorage: AuthStorage;
let services: AgentSessionServices;
let runtime: AgentSessionRuntime;
let result: CreateAgentSessionResult;

interface StartupMetrics {
  totalMs: number;
  servicesMs: number;
  sessionMs: number;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function printBanner() {
  console.log(`\n🧬 ${APP_NAME} v${VERSION}\n`);
}

function printDiagnostics(diagnostics: readonly AgentSessionRuntimeDiagnostic[]) {
  if (diagnostics.length === 0) return;
  console.log('\n📊 Diagnostics:');
  for (const d of diagnostics) {
    const icon = d.type === 'error' ? '❌' : d.type === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`  ${icon} ${d.message}`);
  }
  console.log('');
}

function printStartupMetrics(metrics: StartupMetrics) {
  console.log('\n⏱️  Startup Timing:');
  console.log(`  Total:   ${formatDuration(metrics.totalMs)}`);
  console.log(`  Services: ${formatDuration(metrics.servicesMs)}`);
  console.log(`  Session:  ${formatDuration(metrics.sessionMs)}`);
  console.log('');
}

async function main() {
  const startTime = Date.now();
  let servicesStartTime = 0;
  let sessionStartTime = 0;

  printBanner();

  try {
    console.log('🚀 Initializing...');

    // === SETUP PATHS ===
    cwd = process.cwd();
    agentDir = getAgentDir();

    // Validate environment early
    if (!cwd) {
      throw new Error('Current working directory is not set');
    }

    // === INITIALIZE SYSTEM ===
    sessionManager = SessionManager.create(cwd);
    authStorage = AuthStorage.create();

    // === CREATE RUNTIME ===
    servicesStartTime = Date.now();
    runtime = await createAgentSessionRuntime(
      async ({ cwd: innerCwd, agentDir: innerAgentDir, sessionManager: innerSessionManager }) => {
        // Services
        const servicesStart = Date.now();
        services = await createAgentSessionServices({
          cwd: innerCwd,
          agentDir: innerAgentDir,
          authStorage,
          // Register all extensions via aggregator
          resourceLoaderOptions: {
            extensionFactories: [
              extensionsAggregator
            ]
          }
        });

        // Agent session
        sessionStartTime = Date.now();
        result = await createAgentSessionFromServices({
          services,
          sessionManager: innerSessionManager
        });

        return {
          ...result,
          services,
          diagnostics: services.diagnostics
        };
      },
      {
        cwd: sessionManager.getCwd(),
        agentDir,
        sessionManager
      }
    );

    const totalTime = Date.now() - startTime;
    const servicesTime = sessionStartTime - servicesStartTime;
    const sessionTime = Date.now() - sessionStartTime;

    const metrics: StartupMetrics = {
      totalMs: totalTime,
      servicesMs: servicesTime,
      sessionMs: sessionTime
    };

    // Expose runtime globally for team tool (hapi)
    // This is safe because the app has a single runtime at a time.
    // Extensions can access it via globalThis.__EVO__RUNTIME__.
    (globalThis as any).__EVO__RUNTIME__ = runtime;

    // Print diagnostics and timing
    const allDiagnostics = [...services.diagnostics, ...runtime.diagnostics];
    printDiagnostics(allDiagnostics);
    printStartupMetrics(metrics);

    console.log('✅ Ready');
    await new InteractiveMode(runtime, {}).run();
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error('\n❌ Fatal Error:');
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    console.error(`\n⏱️  Startup failed after ${formatDuration(elapsed)}\n`);
    process.exit(1);
  }
}

// Graceful shutdown
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

main();
