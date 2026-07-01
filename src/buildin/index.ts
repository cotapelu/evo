/**
 * Built-in tools registry
 * Central export point for all built-in tool registration functions.
 */
import {
  registerAllBuildinAndCustomTools,
  registerAllBuiltinTools,
  registerAllCustomTools,
} from './tools/index.js';
import { getAllBuiltinExtensions } from './extensions/index.js';
export {
  registerAllBuiltinTools,
  registerAllCustomTools,
  getAllBuiltinExtensions,
  registerAllBuildinAndCustomTools,
};
import type { AgentTool, ToolDefinition, ExtensionFactory } from './deps.js';

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
