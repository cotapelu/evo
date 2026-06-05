#!/usr/bin/env node

/**
 * Minimal Evo Main - Tối giản với 2 class chính
 *
 * Chỉ dùng:
 * - AgentSessionRuntime (qua createAgentSessionRuntime)
 * - InteractiveMode
 *
 * Tự động load extensions từ src/extensions
 */

import { createAgentSessionRuntime, InteractiveMode, getAgentDir } from '@earendil-works/pi-coding-agent';
import { SessionManager, AuthStorage, ModelRegistry, SettingsManager, createAgentSessionServices, createAgentSessionFromServices } from '@earendil-works/pi-coding-agent';
import { getResourceLoaderOptions } from './extensionLoader.js';

export async function main() {
  try {
    const cwd = process.cwd();
    const agentDir = getAgentDir();

    const runtime = await createAgentSessionRuntime(
      async ({ cwd: innerCwd, agentDir: innerAgentDir, sessionManager: innerSessionManager }) => {
        const authStorage = AuthStorage.create();
        const modelRegistry = ModelRegistry.create(authStorage);
        const settingsManager = SettingsManager.create(innerCwd, innerAgentDir);

        const services = await createAgentSessionServices({
          cwd: innerCwd,
          agentDir: innerAgentDir,
          authStorage,
          settingsManager,
          modelRegistry,
          resourceLoaderOptions: getResourceLoaderOptions(),
        });

        const sessionResult = await createAgentSessionFromServices({
          services,
          sessionManager: innerSessionManager,
        });

        return {
          ...sessionResult,
          services,
          diagnostics: services.diagnostics,
        };
      },
      {
        cwd,
        agentDir,
        sessionManager: SessionManager.create(cwd),
      }
    );

    const interactiveMode = new InteractiveMode(runtime, {});
    await interactiveMode.run();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// main(); // Không gọi trực tiếp, để evo.ts gọi
