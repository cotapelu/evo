import {
  createAgentSessionRuntime,
  InteractiveMode,
  SessionManager,
  AuthStorage,
  SettingsManager,
  ModelRegistry,
  createAgentSessionServices,
  createAgentSessionFromServices
} from '@earendil-works/pi-coding-agent';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

async function main() {
  console.log('\n🧬 Evo Agent\n🚀 Initializing...');

  const cwd = process.cwd();
  const agentDir = join(process.env.HOME || process.env.USERPROFILE || '.', '.pi');
  mkdirSync(agentDir, { recursive: true });
  const sessionManager = SessionManager.create(cwd);

  const runtime = await createAgentSessionRuntime(
    async ({ cwd, agentDir, sessionManager }) => {
      const authStorage = AuthStorage.create(join(agentDir, 'auth.json'));
      const settingsManager = SettingsManager.create(cwd, agentDir);
      const modelRegistry = ModelRegistry.create(authStorage);

      const services = await createAgentSessionServices({
        cwd,
        agentDir,
        authStorage,
        settingsManager,
        modelRegistry,
      });

      const result = await createAgentSessionFromServices({
        services,
        sessionManager
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
