// ============================================================================
// 1. IMPORTS
// ============================================================================

import {
  createReadTool,
  createBashTool,
  createEditTool,
  createWriteTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  type AgentTool
} from '../deps.js';

// ============================================================================
// 2. PUBLIC API
// ============================================================================

/**
 * Registers all built-in file and system operation tools.
 *
 * @param cwd - Working directory for all tools (ensures correct file path resolution)
 * @returns Array of ToolDefinition objects for built-in tools
 *
 * @remarks
 * The following tools are registered:
 * - read: Read file contents
 * - bash: Execute shell commands
 * - edit: Edit files
 * - write: Write files
 * - find: Find files
 * - grep: Search file contents
 * - ls: List directory contents
 */
export function registerAllBuiltinTools(cwd: string): AgentTool[] {
  const tools: AgentTool[] = [];

  tools.push(createReadTool(cwd));
  tools.push(createBashTool(cwd));
  tools.push(createEditTool(cwd));
  tools.push(createWriteTool(cwd));
  tools.push(createFindTool(cwd));
  tools.push(createGrepTool(cwd));
  tools.push(createLsTool(cwd));

  return tools;
}
