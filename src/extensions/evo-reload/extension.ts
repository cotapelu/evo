#!/usr/bin/env node
/**
 * Evo Reload Extension
 *
 * Provides a tool `evo.reload` that allows the LLM to reload the runtime
 * (extensions, skills, prompts, themes) after making changes.
 *
 * This is useful for autonomous development: the agent can modify code,
 * then reload and test the changes without manual intervention.
 */

import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";

/**
 * Extension factory.
 */
export default function evoReloadExtension(api: ExtensionAPI): void {
  // Register command: /reload-evo
  // This is an internal command used by the tool; not advertised to users.
  api.registerCommand('reload-evo', {
    description: 'Reload extensions, skills, prompts, and themes (internal)',
    handler: async (_args: string, ctx: any) => {
      // ctx here is ExtensionCommandContext which has reload()
      await ctx.reload();
      return;
    },
  });

  // Register tool: evo.reload
  // This is the tool the LLM will call.
  const tool: ToolDefinition = {
    name: "evo.reload",
    label: "Reload Runtime",
    description: "Reload extensions, skills, prompts, and themes. Use this after making code changes to apply them without restarting. This reloads the entire runtime to pick up modified extensions, skills, prompts, and themes.",
    promptSnippet: "evo.reload()",
    promptGuidelines: [
      "Call this tool when you have made changes to extension code, skills, prompts, or themes and want to test them.",
      "The reload operation refreshes all runtime components without requiring a full restart.",
      "After reloading, you can continue with testing or further development.",
      "No parameters required."
    ],
    parameters: Type.Object({}), // No parameters

    async execute(toolCallId: string, params: Record<string, any>, signal: AbortSignal | null | undefined, onUpdate: ((data: any) => void) | null | undefined, ctx: any): Promise<any> {
      try {
        // Queue the reload command. Use followUp to avoid interrupting current turn.
        api.sendUserMessage("/reload-evo", { deliverAs: "followUp" });

        return {
          content: [{ type: "text", text: "✅ Runtime reload queued. The system will reload extensions, skills, prompts, and themes. This may take a few seconds." }],
          details: { action: "reload_queued", timestamp: Date.now() },
          isError: false
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `❌ Failed to queue reload: ${error.message}` }],
          details: { error: error.message, stack: error.stack },
          isError: true
        };
      }
    },

    renderResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: any): any {
      const isError = result.isError;
      const details = result.details || {};

      if (options.isPartial) {
        return new Text(theme.fg("warning", "⏳ Queuing reload..."));
      }

      if (isError) {
        return new Text(`${theme.fg("error", "❌ Reload failed")}\n${theme.fg("muted", details.error || "Unknown error")}`);
      }

      if (details.action === "reload_queued") {
        return new Text(`${theme.fg("success", "✅")} ${theme.fg("text", "Reload queued. The system will reload shortly.")}`);
      }

      return new Text(theme.fg("text", "Reload complete"));
    }
  };

  api.registerTool(tool);
}
