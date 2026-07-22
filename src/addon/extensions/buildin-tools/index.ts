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

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (event, ctx) => {
    // Simply re-register all built-in tools
    // This works because createXTool returns a complete AgentTool with correct types
    pi.registerTool(createReadTool(ctx.cwd));
    pi.registerTool(createBashTool(ctx.cwd));
    pi.registerTool(createEditTool(ctx.cwd));
    pi.registerTool(createWriteTool(ctx.cwd));
    pi.registerTool(createFindTool(ctx.cwd));
    pi.registerTool(createGrepTool(ctx.cwd));
    pi.registerTool(createLsTool(ctx.cwd));
  });
}
