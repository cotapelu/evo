// ============================================================================
// BUILDIN TOOLS REGISTRY - CENTRAL ENTRY POINT
// ============================================================================
// Single entry point for all built-in tools and wrappers

import { registerAllBuiltinTools } from './builtin-tools.js';
import { registerAllCustomTools } from './custom-tools.js';
import type { AgentTool, ToolDefinition } from '../deps.js';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Register ALL tools (built-in + custom wrappers)
 * Single function to get complete toolset
 *
 * @param cwd - Working directory for all tools
 * @returns Array of 14 tools (7 AgentTool + 7 ToolDefinition)
 */
export function registerAllBuildinAndCustomTools(cwd: string): (AgentTool | ToolDefinition)[] {
  return [
    ...registerAllBuiltinTools(cwd),
    ...registerAllCustomTools(cwd),
  ];
}

// Re-export individual functions for flexibility
export { registerAllBuiltinTools } from './builtin-tools.js';
export { registerAllCustomTools } from './custom-tools.js';
