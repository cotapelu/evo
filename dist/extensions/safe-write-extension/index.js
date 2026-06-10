#!/usr/bin/env node
/**
 * Safe Write Extension – Demonstrates withFileMutationQueue
 *
 * Provides a `safe_write` tool that atomically writes files using
 * the mutation queue to avoid race conditions and enable debouncing.
 */
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
function createSafeWriteTool() {
    return {
        name: "safe_write",
        label: "Safe Write",
        description: "Atomically write a file using mutation queue (debounced safe).",
        parameters: {
            type: "object",
            properties: {
                file_path: {
                    type: "string",
                    description: "Path to the file to write (relative to cwd)",
                },
                content: {
                    type: "string",
                    description: "Content to write",
                },
            },
            required: ["file_path", "content"],
        },
        async execute(toolCallId, params, signal, onUpdate, ctx) {
            const p = params;
            const relPath = p.file_path;
            const content = p.content;
            if (!relPath || typeof content !== "string") {
                return {
                    content: [{ type: "text", text: "❌ file_path (string) and content (string) required" }],
                    isError: true,
                    details: { error: "missing parameters" },
                };
            }
            const cwd = ctx.cwd || process.cwd();
            const absPath = resolve(cwd, relPath);
            try {
                await withFileMutationQueue(absPath, async () => {
                    const dir = dirname(absPath);
                    await mkdir(dir, { recursive: true });
                    await writeFile(absPath, content);
                });
            }
            catch (e) {
                return {
                    content: [{ type: "text", text: `❌ Error: ${e.message}` }],
                    isError: true,
                    details: { error: e.message },
                };
            }
            return {
                content: [{ type: "text", text: `✅ Wrote ${relPath}` }],
                isError: false,
                details: { path: absPath, bytes: Buffer.byteLength(content, "utf8") },
            };
        },
        renderCall(args, theme, context) {
            const path = args?.file_path || "file";
            return new Text(`safe_write ${path}`, 0, 0);
        },
        renderResult(result, options, theme, context) {
            const resultContent = result.content;
            const text = resultContent?.[0]?.text ?? String(result.content ?? "");
            return new Text(text, 0, 0);
        },
    };
}
export function registerSafeWriteExtension(api) {
    api.registerTool(createSafeWriteTool());
}
export default registerSafeWriteExtension;
//# sourceMappingURL=index.js.map