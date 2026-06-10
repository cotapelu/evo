#!/usr/bin/env node
/**
 * Coding Tools Extension – SDK Factory Usage
 *
 * Uses createCodingTools() to provide lint, typecheck, and test tools.
 * Each tool is enhanced with optional cwd parameter.
 */
import { createCodingTools } from "@earendil-works/pi-coding-agent";
/**
 * Enhance tool with optional cwd parameter
 */
function enhanceToolWithCwd(tool) {
    if (!tool.parameters)
        tool.parameters = { type: 'object', properties: {} };
    const props = tool.parameters.properties;
    if (!props.cwd) {
        props.cwd = { type: 'string', description: 'Working directory (overrides session cwd)' };
    }
    const orig = tool.execute;
    tool.execute = async (toolCallId, params, signal, onUpdate, ctx) => {
        if (params?.cwd)
            ctx = { ...ctx, cwd: params.cwd };
        return orig(toolCallId, params, signal, onUpdate, ctx);
    };
    return tool;
}
export function registerCodingToolsExtension(api) {
    const cwd = '.';
    const tools = createCodingTools(cwd);
    for (const at of tools) {
        // May return either ToolDefinition directly or AgentTool wrapping .tool
        const def = at.tool || at;
        if (def) {
            enhanceToolWithCwd(def);
            api.registerTool(def);
        }
    }
}
export default registerCodingToolsExtension;
//# sourceMappingURL=index.js.map