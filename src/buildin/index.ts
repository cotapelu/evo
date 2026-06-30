/**
 * Built-in tools registry
 * Central export point for all built-in tool registration functions.
 */
import { registerAllBuiltinTools } from './tools/builtin-tools.js';
import { registerAllCustomTools } from './tools/custom-tools.js';
import { getAllBuiltinExtensions } from './extensions/index.js';
export { registerAllBuiltinTools, registerAllCustomTools, getAllBuiltinExtensions };
import type { AgentTool, ToolDefinition, ExtensionFactory } from './deps.js';

/**
 * Registers both built-in tools and custom wrapper tools.
 * Use this to get all available tools for the agent session.
 *
 * @param cwd - Working directory for all tools
 * @returns Array of all tool definitions:
 *   - 7 built-in tools (AgentTool instances)
 *   - 7 custom wrapper tools (ToolDefinition instances with custom names)
 */
export function registerAllBuildinAndCustomTools(cwd: string): (AgentTool | ToolDefinition)[] {
  const builtin = registerAllBuiltinTools(cwd);
  const custom = registerAllCustomTools(cwd);
  return [...builtin, ...custom];
}

/**
 * Registers all built-in components: tools + extensions.
 * Use this to get both tools and extensions for the agent session.
 *
 * @param cwd - Working directory
 * @returns Object containing extensions and tools
 */
export function registerAllBuiltin(cwd: string): {
  extensions: ExtensionFactory[];
  tools: (AgentTool | ToolDefinition)[];
} {
  return {
    extensions: getAllBuiltinExtensions(),
    tools: registerAllBuildinAndCustomTools(cwd),
  };
}

/**
 * Configuration management - main entry point
 */
export { createServicesOptions, type ProcmanSettingsOptions } from './settings-manager.js';
