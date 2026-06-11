#!/usr/bin/env node
/**
 * Audit Tool
 *
 * Runs npm audit to check for security vulnerabilities.
 */
import { createBashTool } from "@earendil-works/pi-coding-agent";
function createAuditTool(cwd) {
    const baseBashTool = createBashTool(cwd, {});
    return {
        name: "audit",
        label: "Dependency Audit",
        description: "Check for security vulnerabilities in dependencies using npm audit.",
        promptSnippet: "audit()",
        promptGuidelines: [
            "Run `npm audit` to find known vulnerabilities",
            "Returns JSON with audit results",
            "Consider suggesting `npm audit fix` if issues found",
        ],
        parameters: {},
        async execute(toolCallId, _params, signal, _onUpdate, ctx) {
            const command = "npm audit --json";
            const bashInput = { command };
            return baseBashTool.execute(toolCallId, bashInput, signal, undefined, ctx);
        },
    };
}
export function registerAuditTool(api) {
    const cwd = process.cwd();
    const auditTool = createAuditTool(cwd);
    api.registerTool(auditTool);
}
//# sourceMappingURL=audit-tool.js.map