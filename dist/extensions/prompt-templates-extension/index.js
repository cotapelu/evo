#!/usr/bin/env node
/**
 * Prompt Templates Extension
 *
 * Provides tools to interact with prompt templates loaded by ResourceLoader.
 * - List available templates
 * - View template content
 * - Expand template with arguments (basic $1, $2, $@ substitution)
 */
// ============================================================================
// Helper: Simple argument substitution
// ============================================================================
function substituteArgs(content, args) {
    let result = content;
    // Replace $1, $2, ... with corresponding arg
    for (let i = 0; i < args.length; i++) {
        const placeholder = `\$${i + 1}`;
        result = result.split(placeholder).join(args[i]);
    }
    // Replace $@ with all args joined by space
    result = result.split("$@").join(args.join(" "));
    // Replace ${@:N:L} slice (bash-like) – optional, skip for brevity
    return result;
}
// ============================================================================
// TOOL: List Prompt Templates
// ============================================================================
export function createListPromptTemplatesTool() {
    return {
        name: "prompt.list",
        label: "Prompts: List",
        description: "List all available prompt templates",
        parameters: {},
        async execute(toolCallId, params, signal, _onUpdate, ctx) {
            try {
                const services = ctx.sdkServices;
                if (!services?.resourceLoader) {
                    return {
                        content: [{ type: "text", text: "❌ ResourceLoader not initialized. Run sdk.init first." }],
                        isError: true,
                        details: { error: "no_resource_loader" },
                    };
                }
                const { prompts } = services.resourceLoader.getPrompts();
                const templates = prompts;
                if (templates.length === 0) {
                    return {
                        content: [{ type: "text", text: "No prompt templates loaded." }],
                        details: { count: 0 },
                        isError: false,
                    };
                }
                const lines = templates.map(p => `  /${p.name} – ${p.description || "(no description)"}`).join("\n");
                return {
                    content: [{ type: "text", text: `Prompt templates (${templates.length}):\n${lines}` }],
                    details: { count: templates.length, templates: templates.map(p => p.name) },
                    isError: false,
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
// TOOL: Expand Prompt Template
// ============================================================================
export function createExpandPromptTemplateTool() {
    return {
        name: "prompt.expand",
        label: "Prompts: Expand",
        description: "Expand a prompt template with arguments (basic $1, $2, $@ substitution)",
        parameters: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "Template name (without leading slash)",
                },
                args: {
                    type: "array",
                    items: { type: "string" },
                    description: "Arguments for substitution ($1, $2, $@)",
                },
            },
            required: ["name"],
        },
        async execute(toolCallId, params, signal, _onUpdate, ctx) {
            try {
                const services = ctx.sdkServices;
                if (!services?.resourceLoader) {
                    return {
                        content: [{ type: "text", text: "❌ ResourceLoader not initialized. Run sdk.init first." }],
                        isError: true,
                        details: { error: "no_resource_loader" },
                    };
                }
                const { prompts } = services.resourceLoader.getPrompts();
                const templateList = prompts;
                const { name, args = [] } = params;
                const template = templateList.find((p) => p.name === name);
                if (!template) {
                    return {
                        content: [{ type: "text", text: `❌ Template not found: /${name}. Use prompt.list to see available.` }],
                        isError: true,
                        details: { error: "not_found", name },
                    };
                }
                const expanded = substituteArgs(template.content, args);
                return {
                    content: [{
                            type: "text",
                            text: `📄 Template: /${template.name}\n\n${expanded}`,
                        }],
                    details: {
                        name: template.name,
                        argCount: args.length,
                        expandedLength: expanded.length,
                    },
                    isError: false,
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
function registerPromptCommands(api) {
    api.registerCommand("prompt.list", {
        description: "List available prompt templates",
        handler: async (args, ctx) => {
            const services = ctx.sdkServices;
            if (!services?.resourceLoader) {
                ctx.ui.notify?.("ResourceLoader not initialized. Run sdk.init first.", "warning");
                return;
            }
            const { prompts } = services.resourceLoader.getPrompts();
            const templates = prompts;
            if (templates.length === 0) {
                ctx.ui.notify?.("No prompt templates loaded.", "info");
                return;
            }
            const lines = templates.slice(0, 20).map((p) => `/${p.name} – ${p.description || ""}`);
            ctx.ui.notify?.(`Templates (${templates.length}):\n${lines.join("\n")}`, "info");
        },
    });
    api.registerCommand("prompt.expand", {
        description: "Expand a template with arguments",
        handler: async (argsRaw, ctx) => {
            const services = ctx.sdkServices;
            if (!services?.resourceLoader) {
                ctx.ui.notify?.("ResourceLoader not initialized. Run sdk.init first.", "warning");
                return;
            }
            // Parse: name arg1 arg2...
            const parts = argsRaw.trim().split(/\s+/);
            if (parts.length === 0) {
                ctx.ui.notify?.("Provide template name and optional args.", "warning");
                return;
            }
            const name = parts[0];
            const args = parts.slice(1);
            const { prompts } = services.resourceLoader.getPrompts();
            const templateList = prompts;
            const template = templateList.find((p) => p.name === name);
            if (!template) {
                ctx.ui.notify?.(`Template not found: /${name}`, "error");
                return;
            }
            const expanded = substituteArgs(template.content, args);
            // Copy to clipboard if possible, else show in notification
            ctx.ui.notify?.(`📄 Expanded (${expanded.length} chars):\\n${expanded.substring(0, 200)}${expanded.length > 200 ? "..." : ""}`, "info");
        },
    });
}
// ============================================================================
// Main
// ============================================================================
export function registerPromptTemplatesExtension(api) {
    api.registerTool(createListPromptTemplatesTool());
    api.registerTool(createExpandPromptTemplateTool());
    registerPromptCommands(api);
    api.sendMessage?.({
        customType: "prompt-templates",
        content: "📝 Prompt Templates extension loaded",
        display: false,
    });
}
export default registerPromptTemplatesExtension;
//# sourceMappingURL=index.js.map