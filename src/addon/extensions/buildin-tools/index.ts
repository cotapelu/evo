import {
  createReadTool,
  createBashTool,
  createEditTool,
  createWriteTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

/**
 * Simple Built-in Tools Override Extension
 *
 * This re-registers all built-in tools with the same names to ensure
 * find, grep, ls are available even when tools are restricted.
 *
 * Usage: Import this in factory.ts to enable.
 */

export default function (api: ExtensionAPI) {
  // Register built-in tools directly during extension initialization
  // Use process.cwd() as default working directory
  const cwd = process.cwd();
  
  api.registerTool(createReadTool(cwd));
  api.registerTool(createBashTool(cwd));
  api.registerTool(createEditTool(cwd));
  api.registerTool(createWriteTool(cwd));
  api.registerTool(createFindTool(cwd));
  api.registerTool(createGrepTool(cwd));
  api.registerTool(createLsTool(cwd));
}
