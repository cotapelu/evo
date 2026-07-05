import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createMultiAgentTool } from './router.js';
import { messageBus } from './message-bus.js';
import { multiAgentRuntime } from './runtime.js';

// Extension wrapper
export default function (api: ExtensionAPI) {
  api.on("session_start", async (event, ctx) => {
    api.registerTool(createMultiAgentTool());
  });
}

// Re-exports for programmatic access
export * from './types.js';
export { messageBus };
export { multiAgentRuntime };
export { createMultiAgentTool };
