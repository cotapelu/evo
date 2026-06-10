#!/usr/bin/env node

import { registerSessionManagerTool } from "./session-manager-tool.js";
import { registerSessionCommands } from "./commands.js";
import { installSessionStatsCache } from "./session-stats-cache.js";
import { registerCustomMessageHandler } from "./custom-messages.js";
import { registerSessionFooter } from "./footer-widget.js";
import { registerSessionKeybindings } from "./keybindings.js";
import { registerMessageRenderer } from "./message-renderer.js";
import { registerCompactionHook } from "./compaction-hook.js";
import { registerSessionSummaryTool } from "./session-summary-tool.js";
import { registerSessionManagerAutocomplete } from "./autocomplete.js";

export default function advancedSessionExtension(api: any): void {
  // Install event subscription cache
  installSessionStatsCache(api);
  // Register custom message handler (inter-extension communication)
  registerCustomMessageHandler(api);
  // Register footer widget (interactive UI)
  registerSessionFooter(api);
  // Register keybindings
  registerSessionKeybindings(api);
  // Register custom message renderer
  registerMessageRenderer(api);
  // Register compaction hook
  registerCompactionHook(api);
  // Register tools
  registerSessionManagerTool(api);
  registerSessionSummaryTool(api);
  // Register commands
  registerSessionCommands(api);
  // Register autocomplete provider
  registerSessionManagerAutocomplete(api);
}

export { advancedSessionExtension };
