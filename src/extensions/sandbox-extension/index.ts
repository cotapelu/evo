#!/usr/bin/env node
/**
 * Sandbox Mode Extension – Read-Only Safeguard
 *
 * Provides sandbox mode with only read capabilities: read, ls, grep, find.
 * Disables write/edit/bash for safety. Uses createReadOnlyTools from SDK.
 */

import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createReadOnlyTools } from "@earendil-works/pi-coding-agent";

// ============================================================================
// TOOL: Enter Sandbox
// ============================================================================
export function createSandboxEnterTool(): ToolDefinition<any, any> {
  return {
    name: "sandbox.enter",
    label: "Sandbox: Enter",
    description: "Activate sandbox mode (read-only tools only). Disables write/edit/bash.",
    parameters: {
      type: "object",
      properties: {
        confirm: { type: "boolean", description: "Set to true to skip confirmation" },
      },
    },
    async execute(toolCallId: string, params: any, _signal: any, _onUpdate: any, ctx: any) {
      try {
        const { confirm = false } = params as { confirm?: boolean };

        if ((ctx as any).sandboxActive) {
          return {
            content: [{ type: "text", text: "⚠️ Sandbox already active" }],
            details: { active: true },
            isError: false,
          };
        }

        if (!confirm) {
          return {
            content: [{
              type: "text",
              text: "🔒 Confirmation Required\n\nThis disables write/edit/bash tools. Call:\n`sandbox.enter({ confirm: true })`",
            }],
            details: { needsConfirmation: true },
            isError: false,
          };
        }

        const api = (ctx as any).extensionAPI;
        if (!api) throw new Error("ExtensionAPI not available");

        const currentTools = api.getActiveTools();
        (ctx as any).preSandboxTools = currentTools;

        // Read-only set
        const readOnly = ["read", "ls", "grep", "find"];
        api.setActiveTools(readOnly);
        (ctx as any).sandboxActive = true;

        return {
          content: [{
            type: "text",
            text: `✅ Sandbox activated\n\nActive: ${readOnly.join(", ")}\nExit: sandbox.exit()`,
          }],
          details: { active: true, activeTools: readOnly, previousTools: currentTools },
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
// TOOL: Exit Sandbox
// ============================================================================
export function createSandboxExitTool(): ToolDefinition<any, any> {
  return {
    name: "sandbox.exit",
    label: "Sandbox: Exit",
    description: "Deactivate sandbox and restore previous tool set",
    parameters: {},
    async execute(toolCallId: string, params: any, _signal: any, _onUpdate: any, ctx: any) {
      try {
        const api = (ctx as any).extensionAPI;
        if (!api) throw new Error("ExtensionAPI not available");

        if (!(ctx as any).sandboxActive) {
          return {
            content: [{ type: "text", text: "⚠️ Sandbox not active" }],
            details: { active: false },
            isError: false,
          };
        }

        const previous = (ctx as any).preSandboxTools;
        if (previous && Array.isArray(previous)) {
          api.setActiveTools(previous);
        } else {
          api.setActiveTools([]);
        }
        (ctx as any).sandboxActive = false;
        (ctx as any).preSandboxTools = undefined;

        return {
          content: [{ type: "text", text: `✅ Sandbox exited\nRestored ${previous?.length || 0} tools` }],
          details: { active: false, restoredCount: previous?.length || 0 },
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
// TOOL: Sandbox Status
// ============================================================================
export function createSandboxStatusTool(): ToolDefinition<any, any> {
  return {
    name: "sandbox.status",
    label: "Sandbox: Status",
    description: "Check sandbox mode status",
    parameters: {},
    async execute(toolCallId: string, params: any, _signal: any, _onUpdate: any, ctx: any) {
      const isActive = !!(ctx as any).sandboxActive;
      const api = (ctx as any).extensionAPI;
      const activeTools = api ? api.getActiveTools() : [];

      return {
        content: [{
          type: "text",
          text: `🔒 Sandbox: ${isActive ? "ACTIVE (read-only)" : "INACTIVE"}\n\nActive tools (${activeTools.length}):\n${activeTools.join(", ") || "(none)"}`,
        }],
        details: { active: isActive, activeTools },
        isError: false,
      };
    },
  };
}

// ============================================================================
// TOOL: Create Custom Sandbox
// ============================================================================
export function createSandboxCreateTool(): ToolDefinition<any, any> {
  return {
    name: "sandbox.create",
    label: "Sandbox: Create",
    description: "Create sandbox with specific read-only tools",
    parameters: {
      type: "object",
      properties: {
        tools: {
          type: "array",
          items: { type: "string", enum: ["read", "ls", "grep", "find"] },
          description: "Read-only tools to enable",
        },
      },
    },
    async execute(toolCallId: string, params: any, _signal: any, _onUpdate: any, ctx: any) {
      try {
        const { tools = ["read", "ls", "grep", "find"] } = params as { tools?: string[] };
        const api = (ctx as any).extensionAPI;
        if (!api) throw new Error("ExtensionAPI not available");

        const currentTools = api.getActiveTools();
        (ctx as any).preSandboxTools = currentTools;
        (ctx as any).sandboxActive = true;

        api.setActiveTools(tools);

        return {
          content: [{
            type: "text",
            text: `✅ Sandbox created\nTools: ${tools.join(", ")}\nExit: sandbox.exit()`,
          }],
          details: { tools, previousCount: currentTools.length },
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
function registerSandboxCommands(api: ExtensionAPI): void {
  api.registerCommand("sandbox.toggle", {
    description: "Toggle sandbox mode on/off",
    handler: async (_args: string, ctx: any) => {
      const api = (ctx as any).extensionAPI;
      if (!api) {
        ctx.ui.notify?.("❌ ExtensionAPI not available", "error");
        return;
      }

      if ((ctx as any).sandboxActive) {
        // Exit
        const previous = (ctx as any).preSandboxTools;
        if (previous && Array.isArray(previous)) {
          api.setActiveTools(previous);
        } else {
          api.setActiveTools([]);
        }
        (ctx as any).sandboxActive = false;
        (ctx as any).preSandboxTools = undefined;
        ctx.ui.notify?.("🔓 Sandbox deactivated", "success");
      } else {
        // Enter
        const currentTools = api.getActiveTools();
        (ctx as any).preSandboxTools = currentTools;
        const readOnly = ["read", "ls", "grep", "find"];
        api.setActiveTools(readOnly);
        (ctx as any).sandboxActive = true;
        ctx.ui.notify?.(`🔒 Sandbox activated (${readOnly.join(", ")})`, "info");
      }
    },
  });

  api.registerCommand("sandbox.on", {
    description: "Enable sandbox (alias for sandbox.enter --confirm)",
    handler: async (_args: string, ctx: any) => {
      ctx.ui.notify?.("Use tool: sandbox.enter({ confirm: true })", "info");
    },
  });

  api.registerCommand("sandbox.off", {
    description: "Disable sandbox",
    handler: async (_args: string, ctx: any) => {
      const api = (ctx as any).extensionAPI;
      if (api) {
        const previous = (ctx as any).preSandboxTools;
        if (previous && Array.isArray(previous)) {
          api.setActiveTools(previous);
        } else {
          api.setActiveTools([]);
        }
        (ctx as any).sandboxActive = false;
        ctx.ui.notify?.("🔓 Sandbox deactivated", "success");
      }
    },
  });
}

// ============================================================================
// Main
// ============================================================================
export function registerSandboxExtension(api: ExtensionAPI): void {
  api.registerTool(createSandboxEnterTool());
  api.registerTool(createSandboxExitTool());
  api.registerTool(createSandboxStatusTool());
  api.registerTool(createSandboxCreateTool());
  registerSandboxCommands(api);

  api.sendMessage?.({
    customType: "sandbox",
    content: "🔒 Sandbox extension loaded",
    display: false,
  });
}

export default registerSandboxExtension;
