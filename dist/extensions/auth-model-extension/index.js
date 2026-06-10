#!/usr/bin/env node
/**
 * Auth & Model Registry Extension
 *
 * Tools and commands for managing authentication and model configurations.
 * Requires sdk.init to be called first to initialize services.
 */
// ============================================================================
// TOOL: List Credentials (AuthStorage)
// ============================================================================
export function createListCredentialsTool() {
    return {
        name: "auth.list",
        label: "Auth: List",
        description: "List stored credentials (provider IDs)",
        parameters: {},
        async execute(toolCallId, params, signal, onUpdate, ctx) {
            try {
                const services = ctx.sdkServices;
                if (!services?.authStorage) {
                    return {
                        content: [{ type: "text", text: "❌ AuthStorage not initialized. Run sdk.init first." }],
                        isError: true,
                        details: { error: "not_initialized" },
                    };
                }
                const credentials = await services.authStorage.list();
                if (credentials.length === 0) {
                    return { content: [{ type: "text", text: "No credentials stored." }], details: { count: 0, credentials: [] } };
                }
                const lines = credentials.map((c) => `  ${c.provider}: ${c.id.substring(0, 8)}...`);
                return {
                    content: [{ type: "text", text: `Credentials (${credentials.length}):\n${lines.join("\n")}` }],
                    details: { count: credentials.length, credentials },
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
// TOOL: Clear Credential
// ============================================================================
export function createClearCredentialTool() {
    return {
        name: "auth.clear",
        label: "Auth: Clear",
        description: "Remove a stored credential by provider ID",
        parameters: {
            type: "object",
            properties: {
                provider: { type: "string", description: "Provider ID (e.g., 'anthropic', 'openai')" },
            },
            required: ["provider"],
        },
        async execute(toolCallId, params, signal, onUpdate, ctx) {
            try {
                const services = ctx.sdkServices;
                if (!services?.authStorage) {
                    return {
                        content: [{ type: "text", text: "❌ AuthStorage not initialized." }],
                        isError: true,
                        details: { error: "not_initialized" },
                    };
                }
                const { provider } = params;
                await services.authStorage.remove(provider);
                return {
                    content: [{ type: "text", text: `✅ Removed credential for ${provider}` }],
                    details: { provider, success: true },
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
// TOOL: List Models (ModelRegistry)
// ============================================================================
export function createListModelsTool() {
    return {
        name: "models.list",
        label: "Models: List",
        description: "List all configured models from registry",
        parameters: {
            type: "object",
            properties: {
                provider: { type: "string", description: "Filter by provider" },
            },
        },
        async execute(toolCallId, params, signal, onUpdate, ctx) {
            try {
                const services = ctx.sdkServices;
                if (!services?.modelRegistry) {
                    return {
                        content: [{ type: "text", text: "❌ ModelRegistry not initialized. Run sdk.init first." }],
                        isError: true,
                        details: { error: "not_initialized" },
                    };
                }
                const allModels = services.modelRegistry.list();
                const { provider } = params;
                const models = provider ? allModels.filter((m) => m.provider === provider) : allModels;
                if (models.length === 0) {
                    return { content: [{ type: "text", text: `No models${provider ? ` for ${provider}` : ''}.` }], details: { count: 0, models: [] } };
                }
                const lines = models.map((m) => `  ${m.id} | ${m.provider} | ctx:${m.contextWindow} | ${m.reasoning ? '🧠' : ''}`);
                return {
                    content: [{ type: "text", text: `Models (${models.length}):\n${lines.join("\n")}` }],
                    details: { count: models.length, models },
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
// TOOL: Get Model Details
// ============================================================================
export function createGetModelTool() {
    return {
        name: "models.get",
        label: "Models: Get",
        description: "Get details for a specific model ID",
        parameters: {
            type: "object",
            properties: {
                modelId: { type: "string", description: "Model ID (e.g., 'claude-3-5-sonnet')" },
            },
            required: ["modelId"],
        },
        async execute(toolCallId, params, signal, onUpdate, ctx) {
            try {
                const services = ctx.sdkServices;
                if (!services?.modelRegistry) {
                    return {
                        content: [{ type: "text", text: "❌ ModelRegistry not initialized." }],
                        isError: true,
                        details: { error: "not_initialized" },
                    };
                }
                const { modelId } = params;
                const model = services.modelRegistry.get(modelId);
                if (!model) {
                    return {
                        content: [{ type: "text", text: `❌ Model not found: ${modelId}` }],
                        isError: true,
                        details: { error: "not_found", modelId },
                    };
                }
                const info = [
                    `ID: ${model.id}`,
                    `Provider: ${model.provider}`,
                    `Context Window: ${model.contextWindow}`,
                    `Max Tokens: ${model.maxTokens}`,
                    `Reasoning: ${model.reasoning ? 'Yes' : 'No'}`,
                    `Cost: input $${model.cost.input}/output $${model.cost.output}`,
                    `API: ${model.api}`,
                ].join("\n");
                return {
                    content: [{ type: "text", text: info }],
                    details: { model },
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
// COMMANDS: Quick Auth & Model Actions
// ============================================================================
function registerAuthModelCommands(api) {
    api.registerCommand("auth.status", {
        description: "Show authentication status",
        handler: async (_args, ctx) => {
            const services = ctx.sdkServices;
            if (!services?.authStorage) {
                ctx.ui.notify?.("AuthStorage not initialized. Run sdk.init first.", "warning");
                return;
            }
            const credentials = await services.authStorage.list();
            const lines = [
                `Stored credentials: ${credentials.length}`,
                ...credentials.map((c) => `  ${c.provider} (${c.id.substring(0, 8)}...)`),
            ];
            ctx.ui.notify?.(lines.join("\n"), "info");
        },
    });
    api.registerCommand("models.count", {
        description: "Show model count by provider",
        handler: async (_args, ctx) => {
            const services = ctx.sdkServices;
            if (!services?.modelRegistry) {
                ctx.ui.notify?.("ModelRegistry not initialized. Run sdk.init first.", "warning");
                return;
            }
            const models = services.modelRegistry.list();
            const counts = {};
            for (const m of models) {
                counts[m.provider] = (counts[m.provider] || 0) + 1;
            }
            const lines = Object.entries(counts).map(([p, n]) => `  ${p}: ${n}`);
            ctx.ui.notify?.(`Models by provider:\n${lines.join("\n")}`, "info");
        },
    });
}
// ============================================================================
// Main Export
// ============================================================================
export function registerAuthModelExtension(api) {
    api.registerTool(createListCredentialsTool());
    api.registerTool(createClearCredentialTool());
    api.registerTool(createListModelsTool());
    api.registerTool(createGetModelTool());
    registerAuthModelCommands(api);
    api.sendMessage?.({
        customType: "auth-model",
        content: "🔐 Auth & Model Registry loaded",
        display: false,
    });
}
export default registerAuthModelExtension;
//# sourceMappingURL=index.js.map