#!/usr/bin/env node
/**
 * Sandbox Mode Extension – Read-Only Safeguard
 *
 * Provides sandbox mode with only read capabilities: read, ls, grep, find.
 * Disables write/edit/bash for safety. Uses createReadOnlyTools from SDK.
 */
// ============================================================================
// TOOL: Enter Sandbox
// ============================================================================
export function createSandboxEnterTool() {
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
        async execute(toolCallId, params, _signal, _onUpdate, ctx) {
            try {
                const { confirm = false } = params;
                if (ctx.sandboxActive) {
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
                const api = ctx.extensionAPI;
                if (!api)
                    throw new Error("ExtensionAPI not available");
                const currentTools = api.getActiveTools();
                ctx.preSandboxTools = currentTools;
                // Read-only set
                const readOnly = ["read", "ls", "grep", "find"];
                api.setActiveTools(readOnly);
                ctx.sandboxActive = true;
                return {
                    content: [{
                            type: "text",
                            text: `✅ Sandbox activated\n\nActive: ${readOnly.join(", ")}\nExit: sandbox.exit()`,
                        }],
                    details: { active: true, activeTools: readOnly, previousTools: currentTools },
                };
            }
            catch (e) {
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
export function createSandboxExitTool() {
    return {
        name: "sandbox.exit",
        label: "Sandbox: Exit",
        description: "Deactivate sandbox and restore previous tool set",
        parameters: {},
        async execute(toolCallId, params, _signal, _onUpdate, ctx) {
            try {
                const api = ctx.extensionAPI;
                if (!api)
                    throw new Error("ExtensionAPI not available");
                if (!ctx.sandboxActive) {
                    return {
                        content: [{ type: "text", text: "⚠️ Sandbox not active" }],
                        details: { active: false },
                    };
                }
                const previous = ctx.preSandboxTools;
                if (previous && Array.isArray(previous)) {
                    api.setActiveTools(previous);
                }
                else {
                    api.setActiveTools([]);
                }
                ctx.sandboxActive = false;
                ctx.preSandboxTools = undefined;
                return {
                    content: [{ type: "text", text: `✅ Sandbox exited\nRestored ${previous?.length || 0} tools` }],
                    details: { active: false, restoredCount: previous?.length || 0 },
                };
            }
            catch (e) {
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
export function createSandboxStatusTool() {
    return {
        name: "sandbox.status",
        label: "Sandbox: Status",
        description: "Check sandbox mode status",
        parameters: {},
        async execute(toolCallId, params, _signal, _onUpdate, ctx) {
            const isActive = !!ctx.sandboxActive;
            const api = ctx.extensionAPI;
            const activeTools = api ? api.getActiveTools() : [];
            return {
                content: [{
                        type: "text",
                        text: `🔒 Sandbox: ${isActive ? "ACTIVE (read-only)" : "INACTIVE"}\n\nActive tools (${activeTools.length}):\n${activeTools.join(", ") || "(none)"}`,
                    }],
                details: { active: isActive, activeTools },
            };
        },
    };
}
// ============================================================================
// TOOL: Create Custom Sandbox
// ============================================================================
export function createSandboxCreateTool() {
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
        async execute(toolCallId, params, _signal, _onUpdate, ctx) {
            try {
                const { tools = ["read", "ls", "grep", "find"] } = params;
                const api = ctx.extensionAPI;
                if (!api)
                    throw new Error("ExtensionAPI not available");
                const currentTools = api.getActiveTools();
                ctx.preSandboxTools = currentTools;
                ctx.sandboxActive = true;
                api.setActiveTools(tools);
                return {
                    content: [{
                            type: "text",
                            text: `✅ Sandbox created\nTools: ${tools.join(", ")}\nExit: sandbox.exit()`,
                        }],
                    details: { tools, previousCount: currentTools.length },
                };
            }
            catch (e) {
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
function registerSandboxCommands(api) {
    api.registerCommand("sandbox.toggle", {
        description: "Toggle sandbox mode on/off",
        handler: async (_args, ctx) => {
            const api = ctx.extensionAPI;
            if (!api) {
                ctx.ui.notify?.("❌ ExtensionAPI not available", "error");
                return;
            }
            if (ctx.sandboxActive) {
                // Exit
                const previous = ctx.preSandboxTools;
                if (previous && Array.isArray(previous)) {
                    api.setActiveTools(previous);
                }
                else {
                    api.setActiveTools([]);
                }
                ctx.sandboxActive = false;
                ctx.preSandboxTools = undefined;
                ctx.ui.notify?.("🔓 Sandbox deactivated", "success");
            }
            else {
                // Enter
                const currentTools = api.getActiveTools();
                ctx.preSandboxTools = currentTools;
                const readOnly = ["read", "ls", "grep", "find"];
                api.setActiveTools(readOnly);
                ctx.sandboxActive = true;
                ctx.ui.notify?.(`🔒 Sandbox activated (${readOnly.join(", ")})`, "info");
            }
        },
    });
    api.registerCommand("sandbox.on", {
        description: "Enable sandbox (alias for sandbox.enter --confirm)",
        handler: async (_args, ctx) => {
            ctx.ui.notify?.("Use tool: sandbox.enter({ confirm: true })", "info");
        },
    });
    api.registerCommand("sandbox.off", {
        description: "Disable sandbox",
        handler: async (_args, ctx) => {
            const api = ctx.extensionAPI;
            if (api) {
                const previous = ctx.preSandboxTools;
                if (previous && Array.isArray(previous)) {
                    api.setActiveTools(previous);
                }
                else {
                    api.setActiveTools([]);
                }
                ctx.sandboxActive = false;
                ctx.ui.notify?.("🔓 Sandbox deactivated", "success");
            }
        },
    });
}
// ============================================================================
// Main
// ============================================================================
export function registerSandboxExtension(api) {
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
//# sourceMappingURL=index.js.map