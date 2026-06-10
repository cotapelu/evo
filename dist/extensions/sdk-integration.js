#!/usr/bin/env node
/**
 * SDK Integration Extension – Simple Implementation
 *
 * Minimal tools to showcase SDK integration without complex typing issues.
 */
// ============================================================================
// Session Info Tool (read-only)
// ============================================================================
export function createSessionInfoTool() {
    return {
        name: "sdk.sessions",
        label: "SDK: Sessions",
        description: "Show session info and graph",
        parameters: {},
        async execute(toolCallId, params, signal, onUpdate, ctx) {
            const p = params;
            const op = p.operation || "info";
            try {
                const anyCtx = ctx;
                const sessionManager = anyCtx.sessionManager;
                if (!sessionManager) {
                    return {
                        content: [{ type: "text", text: "❌ SessionManager not available" }],
                        isError: true,
                        details: { error: "no_session_manager" },
                    };
                }
                if (op === "info") {
                    const entries = sessionManager.getEntries();
                    const leafId = sessionManager.getLeafId();
                    const text = [
                        `Session: ${sessionManager.getSessionId()?.substring(0, 12) ?? 'unknown'}`,
                        `CWD: ${ctx.cwd}`,
                        `Leaf: ${leafId ?? 'none'}`,
                        `Entries: ${entries.length}`,
                        `Messages: ${entries.filter((e) => e.type === 'message').length}`,
                    ].join("\n");
                    return {
                        content: [{ type: "text", text }],
                        details: { entryCount: entries.length, leafId },
                    };
                }
                if (op === "graph") {
                    const branch = sessionManager.getBranch();
                    if (branch.length === 0)
                        return { content: [{ type: "text", text: "(empty branch)" }], details: {} };
                    const lines = branch.slice(-20).map((e) => `${e.id.substring(0, 6)} ${e.type}`);
                    return {
                        content: [{ type: "text", text: lines.join("\n") }],
                        details: { nodes: branch.length },
                    };
                }
                return { content: [{ type: "text", text: `Unknown op: ${op}` }], details: {}, isError: true };
            }
            catch (e) {
                return { content: [{ type: "text", text: `❌ Error: ${e.message}` }], isError: true, details: { error: e.message } };
            }
        },
    };
}
// ============================================================================
// Settings Tool
// ============================================================================
export function createSettingsTool() {
    return {
        name: "sdk.settings",
        label: "SDK: Settings",
        description: "Get/set settings",
        parameters: {},
        async execute(toolCallId, params, signal, onUpdate, ctx) {
            const p = params;
            const action = p.action || "get";
            try {
                const anyCtx = ctx;
                const settingsManager = anyCtx.settingsManager;
                if (!settingsManager) {
                    return { content: [{ type: "text", text: "❌ SettingsManager not available" }], isError: true, details: { error: "no_settings_manager" } };
                }
                if (action === "get") {
                    const key = p.key;
                    if (!key)
                        return { content: [{ type: "text", text: "❌ key required" }], isError: true, details: { error: "missing_key" } };
                    const value = settingsManager.get(key);
                    return { content: [{ type: "text", text: `${key} = ${JSON.stringify(value)}` }], details: { key, value } };
                }
                if (action === "project") {
                    const project = settingsManager.getProjectSettings?.() || {};
                    return { content: [{ type: "text", text: JSON.stringify(project, null, 2) }], details: project };
                }
                return { content: [{ type: "text", text: `Action: ${action}. Use: get (key) or project` }], details: { action } };
            }
            catch (e) {
                return { content: [{ type: "text", text: `❌ ${e.message}` }], isError: true, details: { error: e.message } };
            }
        },
    };
}
// ============================================================================
// Resource Tool (simplified)
// ============================================================================
export function createResourceTool() {
    return {
        name: "sdk.resources",
        label: "SDK: Resources",
        description: "Discover context files",
        parameters: {},
        async execute(toolCallId, params, signal, onUpdate, ctx) {
            try {
                const anyCtx = ctx;
                const resourceLoader = anyCtx.resourceLoader;
                if (!resourceLoader) {
                    return { content: [{ type: "text", text: "❌ ResourceLoader not available" }], isError: true, details: { error: "no_resource_loader" } };
                }
                // Simple discovery
                const resources = await resourceLoader.discover?.(ctx.cwd) || [];
                const paths = resources.map((r) => r.path).slice(0, 20);
                const text = `Context files (${resources.length}):\n` + paths.join("\n");
                return {
                    content: [{ type: "text", text }],
                    details: { count: resources.length, paths },
                };
            }
            catch (e) {
                return { content: [{ type: "text", text: `❌ ${e.message}` }], isError: true, details: { error: e.message } };
            }
        },
    };
}
// ============================================================================
// Quick Command
// ============================================================================
function registerQuickCommand(api) {
    api.registerCommand("sdk.status", {
        description: "Show SDK integration status",
        handler: async (_args, ctx) => {
            const anyCtx = ctx;
            const msg = [
                "🔌 SDK Status:",
                `  SessionManager: ${!!anyCtx.sessionManager ? '✅' : '⭕'}`,
                `  SettingsManager: ${!!anyCtx.settingsManager ? '✅' : '⭕'}`,
                `  ResourceLoader: ${!!anyCtx.resourceLoader ? '✅' : '⭕'}`,
                `  ModelRegistry: ${!!anyCtx.modelRegistry ? '✅' : '⭕'}`,
                "\nTools: sdk.sessions, sdk.settings, sdk.resources",
            ].join("\n");
            ctx.ui.notify?.(msg, { type: "info" });
        },
    });
}
// ============================================================================
// Main
// ============================================================================
export function registerSdkIntegrationExtension(api) {
    api.registerTool(createSessionInfoTool());
    api.registerTool(createSettingsTool());
    api.registerTool(createResourceTool());
    registerQuickCommand(api);
    api.sendMessage?.({
        customType: "sdk-integration",
        content: "🔌 SDK Integration loaded",
        display: false,
    });
}
export default registerSdkIntegrationExtension;
//# sourceMappingURL=sdk-integration.js.map