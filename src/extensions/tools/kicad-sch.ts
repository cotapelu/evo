#!/usr/bin/env node

/**
 * KiCad Schematic Tool
 * Registry-based super-tool with modular commands
 */

import { Type } from "typebox";
import { ToolDefinition } from "@earendil-works/pi-coding-agent";

// ============================================================================
// Load Commands
// ============================================================================

const commands: Record<string, () => Promise<any>> = {
// @ts-ignore
  export: () => import('./commands/export.js'),
// @ts-ignore
  plot: () => import('./commands/plot.js'),
// @ts-ignore
  diff: () => import('./commands/diff.js'),
// @ts-ignore
  generate_netlist: () => import('./commands/netlist.js'),
// @ts-ignore
  erc: () => import('./commands/erc.js'),
// @ts-ignore
  drc: () => import('./commands/drc.js'),
// @ts-ignore
  annotate: () => import('./commands/annotate.js'),
// @ts-ignore
  symbol_check: () => import('./commands/symbol-check.js'),
// @ts-ignore
  field_edit: () => import('./commands/field-edit.js'),
// @ts-ignore
  replace_fonts: () => import('./commands/replace-fonts.js'),
// @ts-ignore
  update_ids: () => import('./commands/update-ids.js'),
};

// ============================================================================
// Tool Factory
// ============================================================================

export function createKicadSchTool(): ToolDefinition {
  return {
    name: "kicad_sch",
    label: "KiCad Schematic",
    description: "Full KiCad Schematic operations via Python API. Commands: export, plot, diff, generate_netlist, erc, drc, annotate, symbol_check, field_edit, replace_fonts, update_ids.",
    promptSnippet: "kicad_sch({ command: '<cmd>', args: {...} })",
    promptGuidelines: [
      "kicad_sch({ command: 'export', args: { input: 'schematic.kicad_sch', format: 'pdf' } })",
      "kicad_sch({ command: 'erc', args: { input: 'schematic.kicad_sch' } })",
      "kicad_sch({ command: 'drc', args: { input: 'schematic.kicad_sch' } })",
      "kicad_sch({ command: 'generate_netlist', args: { input: 'schematic.kicad_sch' } })",
      "kicad_sch({ command: 'annotate', args: { input: 'schematic.kicad_sch' } })",
      "kicad_sch({ command: 'field_edit', args: { input: 'schematic.kicad_sch', field_name: 'Value', field_value: '10k' } })",
    ],
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", enum: Object.keys(commands), description: "Sub-command" },
        args: { type: "object", description: "Arguments" },
      },
      required: ["command", "args"],
    },
    async execute(_toolCallId: string, params: any, signal: AbortSignal | undefined, _onUpdate: any, ctx: any) {
      const { command, args } = params;
      const loader = commands[command];
      if (!loader) {
        return { content: [{ type: "text", text: `Unknown command: ${command}. Use: ${Object.keys(commands).join(', ')}` }], details: null, isError: true } as const;
      }
      try {
        const mod = await loader();
        const cwd = ctx.session?.cwd ?? process.cwd();
        const result = await mod.execute(args, cwd, signal, ctx);
        return { content: [{ type: "text", text: result.stdout }], details: result as any, isError: false } as const;
      } catch (error: any) {
        return { content: [{ type: "text", text: `kicad_sch ${command} error: ${error.message}` }], details: null, isError: true } as const;
      }
    }
  };
}

export function registerKicadSchTool(api: import("@earendil-works/pi-coding-agent").ExtensionAPI): void {
  api.registerTool(createKicadSchTool());
}
