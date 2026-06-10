#!/usr/bin/env node
/**
 * SDK Final Extension – Uses Remaining SDK Features
 *
 * Features: getAgentDir, createAgentSessionServices, AuthStorage, ModelRegistry
 */
import { getAgentDir, createAgentSessionServices } from "@earendil-works/pi-coding-agent";
// ============================================================================
// TOOL: Init Services
// ============================================================================
export function createInitServicesTool() {
    return {
        name: "sdk.init",
        label: "SDK: Init Services",
        description: "Initialize session services (AuthStorage, ModelRegistry, SettingsManager)",
        parameters: {},
        async execute(toolCallId, params, signal, onUpdate, ctx) {
            try {
                const agentDir = getAgentDir();
                const services = await createAgentSessionServices({
                    cwd: ctx.cwd,
                    agentDir,
                });
                // Store services in context for later use
                ctx.sdkServices = services;
                return {
                    content: [{ type: "text", text: `✅ Services initialized\nAgent: ${agentDir}\nSession ID: ${services.sessionId?.substring(0, 8)}` }],
                    details: { agentDir, sessionId: services.sessionId },
                };
            }
            catch (e) {
                return {
                    content: [{ type: "text", text: `❌ ${e.message}` }],
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
function registerAgentCommands(api) {
    api.registerCommand("agent.info", {
        description: "Show agent paths",
        handler: async (_args, ctx) => {
            const dir = getAgentDir();
            ctx.ui.notify?.(`Agent: ${dir}\nCWD: ${ctx.cwd}`, "info");
        },
    });
    api.registerCommand("agent.services", {
        description: "Show initialized services status",
        handler: async (_args, ctx) => {
            const services = ctx.sdkServices;
            if (!services) {
                ctx.ui.notify?.("No services initialized. Use sdk.init tool first.", "warning");
                return;
            }
            const lines = [
                "Services:",
                `  AuthStorage: ${!!services.authStorage ? '✅' : '⭕'}`,
                `  ModelRegistry: ${!!services.modelRegistry ? '✅' : '⭕'}`,
                `  SettingsManager: ${!!services.settingsManager ? '✅' : '⭕'}`,
                `  ResourceLoader: ${!!services.resourceLoader ? '✅' : '⭕'}`,
            ];
            ctx.ui.notify?.(lines.join("\n"), "info");
        },
    });
}
// ============================================================================
// Main
// ============================================================================
export function registerSdkFinalExtension(api) {
    api.registerTool(createInitServicesTool());
    registerAgentCommands(api);
    api.sendMessage?.({
        customType: "sdk-final",
        content: "SDK Final loaded",
        display: false,
    });
}
export default registerSdkFinalExtension;
//# sourceMappingURL=index.js.map