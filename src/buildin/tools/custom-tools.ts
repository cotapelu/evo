// ============================================================================
// 1. IMPORTS
// ============================================================================

import {
  createReadToolDefinition,
  createBashToolDefinition,
  createEditToolDefinition,
  createWriteToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createLsToolDefinition,
  type ToolDefinition
} from '../deps.js';

// ============================================================================
// 2. PUBLIC API
// ============================================================================

/**
 * Registers custom wrappers for built-in tool definitions.
 * Creates 7 wrapper tools with "custom-" prefix and adjusted descriptions.
 *
 * @param cwd - Working directory for all tools
 * @returns Array of 7 custom wrapper ToolDefinition objects
 */
export function registerAllCustomTools(cwd: string): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  const readTool = createReadToolDefinition(cwd);
  tools.push({
    ...readTool,
    name: 'custom-read',
    description: readTool.description + ' (custom wrapper)',
  } as ToolDefinition);

  const bashTool = createBashToolDefinition(cwd);
  tools.push({
    ...bashTool,
    name: 'custom-bash',
    description: bashTool.description + ' (custom wrapper)',
  } as ToolDefinition);

  const editTool = createEditToolDefinition(cwd);
  tools.push({
    ...editTool,
    name: 'custom-edit',
    description: editTool.description + ' (custom wrapper)',
  } as ToolDefinition);

  const writeTool = createWriteToolDefinition(cwd);
  tools.push({
    ...writeTool,
    name: 'custom-write',
    description: writeTool.description + ' (custom wrapper)',
  } as ToolDefinition);

  const findTool = createFindToolDefinition(cwd);
  tools.push({
    ...findTool,
    name: 'custom-find',
    description: findTool.description + ' (custom wrapper)',
  } as ToolDefinition);

  const grepTool = createGrepToolDefinition(cwd);
  tools.push({
    ...grepTool,
    name: 'custom-grep',
    description: grepTool.description + ' (custom wrapper)',
  } as ToolDefinition);

  const lsTool = createLsToolDefinition(cwd);
  tools.push({
    ...lsTool,
    name: 'custom-ls',
    description: lsTool.description + ' (custom wrapper)',
  } as ToolDefinition);

  return tools;
}
