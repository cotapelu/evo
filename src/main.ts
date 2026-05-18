import {
  createAgentSessionRuntime,
  InteractiveMode,
  SessionManager,
  AuthStorage,
  createAgentSessionServices,
  createAgentSessionFromServices,
  getAgentDir
} from '@earendil-works/pi-coding-agent';

// ============================================
// GLOBAL CONSTANTS (reusable everywhere)
// ============================================

// ============================================
// GLOBAL VARIABLES (can be reused later)
// ============================================
let cwd: string;
let agentDir: string;
let sessionManager: SessionManager;
let authStorage: AuthStorage;
let services: any;
let runtime: any;
let result: any;

async function main() {
  console.log('\n🧬 Evo Agent\n');

  // === SETUP PATHS ===
  cwd = process.cwd();
  agentDir = getAgentDir();

  console.log('🚀 Initializing...');

  // === INITIALIZE SYSTEM ===
  sessionManager = SessionManager.create(cwd);
  authStorage = AuthStorage.create();

  // === CREATE RUNTIME ===
  runtime = await createAgentSessionRuntime(
    async ({ cwd: innerCwd, agentDir: innerAgentDir, sessionManager: innerSessionManager }) => {
      // Services
      services = await createAgentSessionServices({
        cwd: innerCwd,
        agentDir: innerAgentDir,
        authStorage,
      });

      // Agent session
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

  console.log('✅ Ready');
  await new InteractiveMode(runtime, {}).run();
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
