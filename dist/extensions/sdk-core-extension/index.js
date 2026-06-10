#!/usr/bin/env node
/**
 * SDK Core Extension – Simplified
 *
 * Uses: createAgentSessionServices, SessionManager, SettingsManager, ModelRegistry
 */
import { getAgentDir, createAgentSessionServices } from "@earendil-works/pi-coding-agent";
// ============================================================================
// TOOL: Session Services Demo
// ============================================================================
function createSessionServicesTool() {
    return {
        name: "sdk.services",
        label: "SDK: Services",
        description: "Create custom session with services",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string", description: "Session display name" },
            },
        },
        async execute(toolCallId, params, signal, onUpdate, ctx) {
            try {
                const agentDir = getAgentDir();
                const cwd = ctx.cwd;
                // Create services
                const services = await createAgentSessionServices({
                    cwd,
                    agentDir,
                });
                // Store in context for later
                ctx.sdkServices = services;
                return {
                    content: [{ type: "text", text: `✅ Services initialized\nCWD: ${cwd}\nAgent: ${agentDir}` }],
                    details: { cwd, agentDir },
                };
            }
            catch (e) {
                return {
                    content: [{ type: "text", text: `❌ Error: ${e.message}` }],
                    isError: true,
                    details: { error: e.message },
                };
            }
        },
    };
}
// ============================================================================
// COMMAND: Agent Info
// ============================================================================
function registerAgentInfoCommand(api) {
    api.registerCommand("agent.info", {
        description: "Show agent paths",
        handler: async (_args, ctx) => {
            const dir = getAgentDir();
            const msg = [
                `Agent dir: ${dir}`,
                `CWD: ${ctx.cwd}`,
                `Session: ${ctx.sessionManager?.getSessionId()?.substring(0, 8)}`,
            ].join("\n");
            ctx.ui.notify?.(msg, "info");
        },
    });
}
// ============================================================================
// EVENT: Lifecycle tracker
// ============================================================================
function registerLifecycleMonitor(api) {
    const events = [];
    api.on("session_start", (_e, _c) => events.push(`start`));
    api.on("session_shutdown", (_e, _c) => events.push(`shutdown`));
    api.registerCommand("lifecycle.tail", {
        description: "Show lifecycle events",
        handler: async (_args, ctx) => {
            ctx.ui.notify?.(events.slice(-10).reverse().join("\n") || "(none)", "info");
        },
    });
}
// ============================================================================
// Main
// ============================================================================
export function registerSdkCoreExtension(api) {
    api.registerTool(createSessionServicesTool());
    registerAgentInfoCommand(api);
    registerLifecycleMonitor(api);
    api.sendMessage?.({
        customType: "sdk-core",
        content: "SDK Core loaded",
        display: false,
    });
}
export default registerSdkCoreExtension;
//# sourceMappingURL=index.js.map