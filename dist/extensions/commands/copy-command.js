#!/usr/bin/env node
/**
 * Copy Command
 *
 * Copy last assistant response to clipboard.
 * Usage: /copy (copies most recent assistant message text)
 */
import { copyToClipboard } from "@earendil-works/pi-coding-agent";
function isMessageEntry(entry) {
    return entry.type === "message";
}
function getMessageRole(entry) {
    if (entry.type !== "message")
        return null;
    const msg = entry.message;
    return msg?.role ?? null;
}
function extractTextContent(message) {
    if (!message?.content)
        return "";
    const content = message.content;
    if (!Array.isArray(content))
        return "";
    const textParts = content.filter(c => c.type === "text" && c.text).map(c => c.text);
    return textParts.join("\n");
}
export function registerCopyCommand(api) {
    api.registerCommand("copy", {
        description: "Copy last assistant response to clipboard",
        handler: async (_args, ctx) => {
            try {
                const sessionManager = ctx.sessionManager;
                if (!sessionManager) {
                    ctx.ui.notify("Session manager not available", "error");
                    return;
                }
                // Get full tree (SessionTreeNode[])
                const tree = sessionManager.getTree();
                if (tree.length === 0) {
                    ctx.ui.notify("No session history", "error");
                    return;
                }
                // Find last assistant message (reverse iterate)
                let lastAssistantMessage = null;
                for (let i = tree.length - 1; i >= 0; i--) {
                    const node = tree[i];
                    // Each node is a SessionTreeNode with .entry property
                    const entry = node.entry;
                    if (isMessageEntry(entry)) {
                        const role = getMessageRole(entry);
                        if (role === "assistant") {
                            const msg = entry.message;
                            const text = extractTextContent(msg);
                            if (text.trim()) {
                                lastAssistantMessage = { entry, text };
                                break;
                            }
                        }
                    }
                }
                if (!lastAssistantMessage) {
                    ctx.ui.notify("No assistant response found", "error");
                    return;
                }
                // Copy to clipboard
                await copyToClipboard(lastAssistantMessage.text);
                ctx.ui.notify("Copied last assistant response to clipboard", "info");
            }
            catch (error) {
                ctx.ui.notify(`Failed to copy: ${error?.message || "unknown error"}`, "error");
            }
        },
    });
}
//# sourceMappingURL=copy-command.js.map