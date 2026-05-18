import { createAgentSessionRuntime, InteractiveMode, createAgentSessionServices, createAgentSessionFromServices, AuthStorage, getAgentDir, SessionManager } from '@earendil-works/pi-coding-agent';


async function main() {
  console.log('\n🧬 Evo Agent\n');
  const cwd = process.cwd();
  const agentDir = getAgentDir();

  console.log('🚀 Initializing...');

  // Create session manager (fresh session)
  const sessionManager = SessionManager.create(cwd);

  // Create auth storage
  const authStorage = AuthStorage.create();

  // Factory to create runtime
  const createRuntime = async (options: { cwd: string; agentDir: string; sessionManager: SessionManager }) => {
    const { cwd, agentDir, sessionManager } = options;

    // Create services
    const services = await createAgentSessionServices({
      cwd,
      agentDir,
      authStorage,
    });

    // Create session
    const created = await createAgentSessionFromServices({
      services,
      sessionManager,
    });

    // Return full result with services and diagnostics
    return {
      ...created,
      services,
      diagnostics: services.diagnostics,
    };
  };

  // Create runtime
  const runtime = await createAgentSessionRuntime(createRuntime, {
    cwd: sessionManager.getCwd(),
    agentDir,
    sessionManager,
  });

  console.log('✅ Ready');
  await new InteractiveMode(runtime, {}).run();
}

process.on('SIGINT',  ()    => process.exit(0));
process.on('SIGTERM', ()    => process.exit(0));

await main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
