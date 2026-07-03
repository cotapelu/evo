import type { AgentTool } from "../deps.js";
import type { ToolDefinition } from "../deps.js";

/**
 * Synthesize a minimal ToolDefinition from an AgentTool.
 */
export function createToolDefinitionFromAgentTool(tool: AgentTool<any>): ToolDefinition<any, unknown> {
	return {
		name: tool.name,
		label: tool.label,
		description: tool.description,
		parameters: tool.parameters as any,
		prepareArguments: tool.prepareArguments,
		executionMode: tool.executionMode,
		execute: async (toolCallId, params, signal, onUpdate) => tool.execute(toolCallId, params, signal, onUpdate),
	};
}
