/**
 * Runtime Provider - Creates and configures the agent session runtime
 *
 * Handles all runtime initialization: paths, services, extensions, diagnostics, metrics.
 * Returns the ready-to-use AgentSessionRuntime.
 */
import { createAgentSessionRuntime, SessionManager, AuthStorage, createAgentSessionServices, createAgentSessionFromServices, getAgentDir } from '@earendil-works/pi-coding-agent';
// Re-export types for other modules
// Import extensions aggregator (registers all extensions)
import extensionsAggregator from './extensions/index.js';
import { setGlobalRuntime } from './runtime-runner.js';
export async function createAndRunRuntime() {
    const startTime = Date.now();
    let servicesStartTime = 0;
    let sessionStartTime = 0;
    // === SETUP PATHS ===
    const cwd = process.cwd();
    const agentDir = getAgentDir();
    // Validate environment early
    if (!cwd) {
        throw new Error('Current working directory is not set');
    }
    // === INITIALIZE SYSTEM ===
    const sessionManager = SessionManager.create(cwd);
    const authStorage = AuthStorage.create();
    // Declare these in outer scope to access after factory
    let services;
    let result;
    // === CREATE RUNTIME ===
    servicesStartTime = Date.now();
    const runtime = await createAgentSessionRuntime(async ({ cwd: innerCwd, agentDir: innerAgentDir, sessionManager: innerSessionManager }) => {
        // Services
        const servicesStart = Date.now();
        services = await createAgentSessionServices({
            cwd: innerCwd,
            agentDir: innerAgentDir,
            authStorage,
            resourceLoaderOptions: {
                extensionFactories: [extensionsAggregator]
            }
        });
        // Agent session
        sessionStartTime = Date.now();
        result = await createAgentSessionFromServices({
            services,
            sessionManager: innerSessionManager
            // No explicit tools list - all built-in + extension tools are enabled by default
        });
        return {
            ...result,
            services,
            diagnostics: services.diagnostics
        };
    }, {
        cwd: sessionManager.getCwd(),
        agentDir,
        sessionManager
    });
    const totalTime = Date.now() - startTime;
    const servicesTime = sessionStartTime - servicesStartTime;
    const sessionTime = Date.now() - sessionStartTime;
    const metrics = {
        totalMs: totalTime,
        servicesMs: servicesTime,
        sessionMs: sessionTime
    };
    const allDiagnostics = [...services.diagnostics, ...runtime.diagnostics];
    // Expose global runtime for tools that need it (e.g., team_run)
    setGlobalRuntime(runtime);
    return { runtime, services, result, metrics, diagnostics: allDiagnostics };
}
export function formatDuration(ms) {
    if (ms < 1000)
        return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}
export function printBanner() {
    console.log(`\n🧬 Evo Agent v0.0.1\n`);
}
export function printDiagnostics(diagnostics) {
    if (diagnostics.length === 0)
        return;
    console.log('\n📊 Diagnostics:');
    for (const d of diagnostics) {
        const icon = d.type === 'error' ? '❌' : d.type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`  ${icon} ${d.message}`);
    }
    console.log('');
}
export function printStartupMetrics(metrics) {
    console.log('\n⏱️  Startup Timing:');
    console.log(`  Total:   ${formatDuration(metrics.totalMs)}`);
    console.log(`  Services: ${formatDuration(metrics.servicesMs)}`);
    console.log(`  Session:  ${formatDuration(metrics.sessionMs)}`);
    console.log('');
}
//# sourceMappingURL=runtime-provider.js.map