#!/usr/bin/env node
/**
 * Resource Loader Extension – Project Context Discovery with Safety Limits
 *
 * Automatically adds project documentation to the agent's context.
 * - Scans for common docs: AGENTS.md, README.md, README.*.md, docs/*.md, etc.
 * - Injects these files into the system prompt via `before_agent_start`.
 * - Provides a tool to list loaded resources (both built-in and extra).
 *
 * Does not use `resources_discover` for agentsFiles; uses session_start + before_agent_start.
 *
 * Safety limits to avoid context overflow:
 * - Max 10 files included
 * - Each file limited to 100KB
 * - Files sorted by priority (AGENTS.md > README.md > others)
 */

import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { join, relative } from "node:path";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

// ============================================================================
// Extension State
// ============================================================================
let extraAgentsFiles: Array<{ path: string; content: string }> = [];

// ============================================================================
// Limits to prevent context overflow
// ============================================================================
const MAX_FILES = 10;
const MAX_FILE_BYTES = 100 * 1024; // 100KB

// ============================================================================
// Scanning
// ============================================================================
function scanDocumentation(cwd: string): Array<{ path: string; content: string }> {
  const additionalFiles: Array<{ path: string; content: string; priority: number }> = [];

  const isDocFile = (filename: string): boolean => {
    return filename.endsWith(".md") || filename.endsWith(".MD");
  };

  function computePriority(path: string): number {
    const lower = path.toLowerCase();
    if (lower.includes("agents.md") || lower.includes("claude.md")) return 3;
    if (lower.includes("readme")) return 2;
    if (lower.includes("docs/")) return 1;
    return 0;
  }

  function scanDir(dir: string): void {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (
          entry.name.startsWith(".") ||
          entry.name === "node_modules" ||
          entry.name === "dist" ||
          entry.name === "build" ||
          entry.name === ".git"
        ) {
          continue;
        }
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (isDocFile(entry.name)) {
          // Quick check: path must be relevant
          if (!computePriority(fullPath)) continue;
          try {
            // Check file size before reading
            const stat = statSync(fullPath);
            if (stat.size > MAX_FILE_BYTES) {
              continue; // skip too large files
            }
            let content = readFileSync(fullPath, "utf-8");
            // Truncate if still too large after reading (character vs byte)
            if (content.length > MAX_FILE_BYTES) {
              content = content.substring(0, MAX_FILE_BYTES);
            }
            const relPath = relative(cwd, fullPath);
            additionalFiles.push({ path: relPath, content, priority: computePriority(relPath) });
          } catch (e) {
            // ignore read errors
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  scanDir(cwd);

  // Sort by priority descending, then by path length ascending (shallower first)
  additionalFiles.sort((a, b) => b.priority - a.priority || a.path.length - b.path.length);

  // Limit number of files to avoid huge context
  const limited = additionalFiles.slice(0, MAX_FILES);
  return limited.map(f => ({ path: f.path, content: f.content }));
}

// ============================================================================
// Event Handlers
// ============================================================================
function registerEventHandlers(api: ExtensionAPI): void {
  // On session start: scan for additional documentation files
  api.on("session_start", async (_event, ctx) => {
    const cwd = ctx.cwd;
    extraAgentsFiles = scanDocumentation(cwd);
  });

  // Before agent starts: inject extra files into system prompt
  api.on("before_agent_start", async (_event, ctx) => {
    if (extraAgentsFiles.length === 0) {
      return;
    }

    const currentPrompt = ctx.getSystemPrompt();
    let extraBlock = "\n\n<project_context>\n\nProject-specific instructions and guidelines (additional):\n\n";
    for (const file of extraAgentsFiles) {
      extraBlock += `<project_instructions path="${file.path}">\n${file.content}\n</project_instructions>\n\n`;
    }
    extraBlock += "</project_context>\n";

    const newPrompt = currentPrompt + extraBlock;
    return { systemPrompt: newPrompt };
  });
}

// ============================================================================
// TOOL: List Resources
// ============================================================================
export function createListResourcesTool(): ToolDefinition<any, any> {
  return {
    name: "resources.list",
    label: "Resources: List",
    description: "List all project documentation resources loaded into context",
    parameters: {},
    async execute(toolCallId: string, params: any, signal: any, _onUpdate: any, ctx: any) {
      try {
        const services = ctx.sdkServices;
        if (!services?.resourceLoader) {
          return {
            content: [{ type: "text", text: "❌ ResourceLoader not initialized. Run sdk.init first." }],
            isError: true,
            details: { error: "no_resource_loader" },
          };
        }

        const defaultAgents = services.resourceLoader.getAgentsFiles().agentsFiles || [];
        const allFiles = [...defaultAgents, ...extraAgentsFiles];

        if (allFiles.length === 0) {
          return {
            content: [{ type: "text", text: "No resources loaded." }],
            details: { count: 0 },
            isError: false,
          };
        }

        const lines = allFiles.map((f: any) => `  ${f.path} (${f.content.length} bytes)`).join("\n");
        return {
          content: [{ type: "text", text: `Loaded resources (${allFiles.length}):\n${lines}` }],
          details: { count: allFiles.length, files: allFiles.map((f: any) => f.path) },
          isError: false,
        };
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `❌ Error: ${e.message}` }],
          isError: true,
          details: { error: e.message, stack: e.stack },
        };
      }
    },
  };
}

// ============================================================================
// COMMANDS
// ============================================================================
function registerResourceCommands(api: ExtensionAPI): void {
  api.registerCommand("resources.list", {
    description: "List loaded project resources",
    handler: async (args: string, ctx: any) => {
      const services = ctx.sdkServices;
      if (!services?.resourceLoader) {
        ctx.ui.notify?.("ResourceLoader not initialized. Run sdk.init first.", "warning");
        return;
      }

      const defaultAgents = services.resourceLoader.getAgentsFiles().agentsFiles || [];
      const allFiles = [...defaultAgents, ...extraAgentsFiles];
      if (allFiles.length === 0) {
        ctx.ui.notify?.("No resources loaded.", "info");
        return;
      }
      const lines = allFiles.slice(0, 20).map((f: any) => f.path);
      ctx.ui.notify?.(`Resources (${allFiles.length}):\n${lines.join("\n")}`, "info");
    },
  });

  api.registerCommand("resources.reload", {
    description: "Reload resource loader to rescan project files (with cache invalidation)",
    handler: async (args: string, ctx: any) => {
      const services = ctx.sdkServices;
      if (!services?.resourceLoader) {
        ctx.ui.notify?.("ResourceLoader not initialized. Run sdk.init first.", "warning");
        return;
      }

      try {
        // Invalidate our cache before reload so next discover gets fresh scan
        extraAgentsFiles = []; // Clear our cache
        await services.resourceLoader.reload();
        // After reload, our session_start will fire again and rescan
        ctx.ui.notify?.("✅ Resource loader reloaded (cache cleared)", "success");
      } catch (e: any) {
        ctx.ui.notify?.(`❌ Reload failed: ${e.message}`, "error");
      }
    },
  });
}

// ============================================================================
// Main
// ============================================================================
export function registerResourceLoaderExtension(api: ExtensionAPI): void {
  registerEventHandlers(api);
  api.registerTool(createListResourcesTool());
  registerResourceCommands(api);

  api.sendMessage?.({
    customType: "resource-loader",
    content: "📚 Resource Loader extension loaded – auto-adding project docs to context",
    display: false,
  });
}

export { scanDocumentation };
export default registerResourceLoaderExtension;
