#!/usr/bin/env node
/**
 * Session Utils Extension – Branch Summary
 *
 * Standalone tool for generating branch summaries.
 * Requires: sdk.init (SessionManager) and a selected model.
 */
import { generateBranchSummary, prepareBranchEntries, } from "@earendil-works/pi-coding-agent";
// ============================================================================
// TOOL: Generate Branch Summary
// ============================================================================
export function createBranchSummaryTool() {
    return {
        name: "session.summary",
        label: "Session: Branch Summary",
        description: "Generate a concise summary of the current session branch",
        parameters: {
            type: "object",
            properties: {
                maxTokens: {
                    type: "number",
                    description: "Approximate token budget for the summary (default: 2000)",
                },
                customInstructions: {
                    type: "string",
                    description: "Optional custom instructions for the summary",
                },
            },
        },
        async execute(toolCallId, params, signal, _onUpdate, ctx) {
            try {
                const sessionManager = ctx.sessionManager;
                // Model may be optional if we can get from context; but we'll use any
                const model = ctx.model;
                const services = ctx.sdkServices;
                if (!sessionManager) {
                    return {
                        content: [{ type: "text", text: "❌ SessionManager not available. Run sdk.init first." }],
                        isError: true,
                        details: { error: "no_session_manager" },
                    };
                }
                if (!model) {
                    return {
                        content: [{ type: "text", text: "❌ No model selected. Please select a model first." }],
                        isError: true,
                        details: { error: "no_model" },
                    };
                }
                // Get full entries to summarize (entire branch)
                const entries = sessionManager.getEntries();
                if (entries.length === 0) {
                    return {
                        content: [{ type: "text", text: "Branch is empty." }],
                        details: { branchLength: 0 },
                    };
                }
                // Prepare entries with token budget using prepareBranchEntries (exported)
                const maxTokens = params?.maxTokens ?? 2000;
                const preparation = prepareBranchEntries(entries, maxTokens);
                const messages = preparation.messages;
                // Get API key
                let apiKey;
                if (services?.authStorage) {
                    apiKey = await services.authStorage.getApiKey(model.provider);
                }
                // Build options for generateBranchSummary
                // @ts-ignore – typing mismatch optional fields
                const options = {
                    model,
                    apiKey,
                    signal,
                    reserveTokens: 0, // already constrained by prepareBranchEntries
                };
                if (params?.customInstructions)
                    options.customInstructions = params.customInstructions;
                // @ts-ignore – SDK typing
                const summary = await generateBranchSummary(messages, options);
                if (summary.error) {
                    return {
                        content: [{ type: "text", text: `❌ Error: ${summary.error}` }],
                        isError: true,
                        details: { error: summary.error },
                    };
                }
                return {
                    content: [{
                            type: "text",
                            text: `📊 Branch Summary\n\n• Entries: ${messages.length}\n• Estimated tokens: ${summary.estimatedTokens ?? 'unknown'}\n\n${summary.summary || '(empty)'}`,
                        }],
                    details: {
                        entryCount: messages.length,
                        estimatedTokens: summary.estimatedTokens,
                        summary: summary.summary,
                    },
                    isError: false,
                };
            }
            catch (e) {
                return {
                    content: [{ type: "text", text: `❌ Summary failed: ${e.message}` }],
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
function registerSessionCommands(api) {
    api.registerCommand("session.summary", {
        description: "Generate branch summary",
        handler: async (args, ctx) => {
            const sessionManager = ctx.sessionManager;
            const model = ctx.model;
            const services = ctx.sdkServices;
            if (!sessionManager) {
                ctx.ui.notify?.("SessionManager not available. Run sdk.init first.", "warning");
                return;
            }
            if (!model) {
                ctx.ui.notify?.("No model selected.", "warning");
                return;
            }
            try {
                const entries = sessionManager.getEntries();
                const preparation = prepareBranchEntries(entries, 2000);
                const messages = preparation.messages;
                let apiKey;
                if (services?.authStorage) {
                    apiKey = await services.authStorage.getApiKey(model.provider);
                }
                // @ts-ignore
                const summary = await generateBranchSummary(messages, {
                    model,
                    apiKey,
                    signal: ctx.signal,
                });
                ctx.ui.notify?.(`📊 Summary: ~${summary.estimatedTokens} tokens`, "info");
            }
            catch (e) {
                ctx.ui.notify?.(`❌ Failed: ${e.message}`, "error");
            }
        },
    });
}
// ============================================================================
// Main
// ============================================================================
export function registerSessionUtilsExtension(api) {
    api.registerTool(createBranchSummaryTool());
    registerSessionCommands(api);
    api.sendMessage?.({
        customType: "session-utils",
        content: "📊 Session Utils loaded (summary)",
        display: false,
    });
}
export default registerSessionUtilsExtension;
//# sourceMappingURL=index.js.map