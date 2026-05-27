#!/usr/bin/env node

/**
 * KiCad PCB Tool
 * Registry-based super-tool with modular commands
 */

import { Type } from "typebox";
import { ToolDefinition } from "@earendil-works/pi-coding-agent";

// ============================================================================
// Load Commands
// ============================================================================

const commands: Record<string, () => Promise<any>> = {
// @ts-ignore
  plot: () => import('./commands/plot.js'),
// @ts-ignore
  export: () => import('./commands/export.js'),
// @ts-ignore
  drc: () => import('./commands/drc.js'),
// @ts-ignore
  fill_zone: () => import('./commands/fill-zone.js'),
// @ts-ignore
  copper_pour: () => import('./commands/copper-pour.js'),
// @ts-ignore
  route: () => import('./commands/route.js'),
// @ts-ignore
  ratsnest: () => import('./commands/ratsnest.js'),
// @ts-ignore
  drill: () => import('./commands/drill.js'),
// @ts-ignore
  optimize: () => import('./commands/optimize.js'),
// @ts-ignore
  teardrops: () => import('./commands/teardrops.js'),
// @ts-ignore
  zone_filling: () => import('./commands/zone-filling.js'),
// @ts-ignore
  clearance: () => import('./commands/clearance.js'),
// @ts-ignore
  length_tuning: () => import('./commands/length-tuning.js'),
// @ts-ignore
  fanout: () => import('./commands/fanout.js'),
// @ts-ignore
  gloss: () => import('./commands/gloss.js'),
// @ts-ignore
  swap: () => import('./commands/swap.js'),
// @ts-ignore
  tie: () => import('./commands/tie.js'),
// @ts-ignore
  clean: () => import('./commands/clean.js'),
// @ts-ignore
  inspect: () => import('./commands/inspect.js'),
// @ts-ignore
  measure: () => import('./commands/measure.js'),
// @ts-ignore
  footprint: () => import('./commands/footprint.js'),
// @ts-ignore
  pad: () => import('./commands/pad.js'),
// @ts-ignore
  via: () => import('./commands/via.js'),
// @ts-ignore
  track: () => import('./commands/track.js'),
// @ts-ignore
  zone: () => import('./commands/zone.js'),
};

// ============================================================================
// Tool Factory
// ============================================================================

export function createKicadPcbTool(): ToolDefinition {
  return {
    name: "kicad_pcb",
    label: "KiCad PCB",
    description: "Full KiCad PCB layout operations via Python API.",
    promptSnippet: "kicad_pcb({ command: '<cmd>', args: {...} })",
    promptGuidelines: [
      "kicad_pcb({ command: 'plot', args: { input: 'board.kicad_pcb', layers: ['F.Cu', 'B.Cu'], drill: true } })",
      "kicad_pcb({ command: 'export', args: { input: 'board.kicad_pcb', format: 'step' } })",
      "kicad_pcb({ command: 'drc', args: { input: 'board.kicad_pcb' } })",
      "kicad_pcb({ command: 'fill_zone', args: { input: 'board.kicad_pcb', all: true } })",
      "kicad_pcb({ command: 'route', args: { input: 'board.kicad_pcb', start: 'U1-1', end: 'U2-1' } })",
      "kicad_pcb({ command: 'drill', args: { input: 'board.kicad_pcb', map: true } })",
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
        return { content: [{ type: "text", text: `kicad_pcb ${command} error: ${error.message}` }], details: null, isError: true } as const;
      }
    }
  };
}

export function registerKicadPcbTool(api: import("@earendil-works/pi-coding-agent").ExtensionAPI): void {
  api.registerTool(createKicadPcbTool());
}
