#!/usr/bin/env node
/**
 * Test Tool
 *
 * Provides a tool to run the project's test suite (vitest).
 * Can be invoked by the LLM.
 */
import { createBashTool } from "@earendil-works/pi-coding-agent";
function createTestTool(cwd) {
    const baseBashTool = createBashTool(cwd, {});
    return {
        name: "test",
        label: "Test Runner",
        description: "Run the project's test suite (vitest). Supports running specific test files.",
        promptSnippet: "test({ files?: string[], watch?: boolean })",
        promptGuidelines: [
            "Run project tests using vitest",
            "files: optional array of test file paths (e.g., ['src/tests/git-tool.test.ts'])",
            "watch: run in watch mode (default false) – usually keep false",
        ],
        parameters: {},
        async execute(toolCallId, params, signal, _onUpdate, ctx) {
            // Build command string
            let cmd = "npm test";
            if (params.files && params.files.length > 0) {
                // Escape file names with quotes
                const fileStr = params.files.map(f => `"${f.replace(/"/g, '\\"')}"`).join(" ");
                cmd += ` -- ${fileStr}`;
            }
            if (params.watch) {
                cmd += " -- --watch";
            }
            const bashInput = { command: cmd };
            return baseBashTool.execute(toolCallId, bashInput, signal, undefined, ctx);
        },
    };
}
export function registerTestTool(api) {
    const cwd = process.cwd();
    const testTool = createTestTool(cwd);
    api.registerTool(testTool);
}
//# sourceMappingURL=test-tool.js.map