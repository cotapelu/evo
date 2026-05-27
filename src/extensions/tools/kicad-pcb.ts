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
  plot: () => import('./kicad-pcb/commands/plot.js'),
// @ts-ignore
  export: () => import('./kicad-pcb/commands/export.js'),
// @ts-ignore
  drc: () => import('./kicad-pcb/commands/drc.js'),
// @ts-ignore
  fill_zone: () => import('./kicad-pcb/commands/fill-zone.js'),
// @ts-ignore
  copper_pour: () => import('./kicad-pcb/commands/copper-pour.js'),
// @ts-ignore
  route: () => import('./kicad-pcb/commands/route.js'),
// @ts-ignore
  ratsnest: () => import('./kicad-pcb/commands/ratsnest.js'),
// @ts-ignore
  drill: () => import('./kicad-pcb/commands/drill.js'),
// @ts-ignore
  optimize: () => import('./kicad-pcb/commands/optimize.js'),
// @ts-ignore
  teardrops: () => import('./kicad-pcb/commands/teardrops.js'),
// @ts-ignore
  zone_filling: () => import('./kicad-pcb/commands/zone-filling.js'),
// @ts-ignore
  clearance: () => import('./kicad-pcb/commands/clearance.js'),
// @ts-ignore
  length_tuning: () => import('./kicad-pcb/commands/length-tuning.js'),
// @ts-ignore
  fanout: () => import('./kicad-pcb/commands/fanout.js'),
// @ts-ignore
  gloss: () => import('./kicad-pcb/commands/gloss.js'),
// @ts-ignore
  swap: () => import('./kicad-pcb/commands/swap.js'),
// @ts-ignore
  tie: () => import('./kicad-pcb/commands/tie.js'),
// @ts-ignore
  clean: () => import('./kicad-pcb/commands/clean.js'),
// @ts-ignore
  inspect: () => import('./kicad-pcb/commands/inspect.js'),
// @ts-ignore
  measure: () => import('./kicad-pcb/commands/measure.js'),
// @ts-ignore
  footprint: () => import('./kicad-pcb/commands/footprint.js'),
// @ts-ignore
  pad: () => import('./kicad-pcb/commands/pad.js'),
// @ts-ignore
  via: () => import('./kicad-pcb/commands/via.js'),
// @ts-ignore
  track: () => import('./kicad-pcb/commands/track.js'),
// @ts-ignore
  zone: () => import('./kicad-pcb/commands/zone.js'),
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
        // Treat non-zero exit as error
        if (result.code !== 0) {
          throw new Error(result.stderr || `Command ${command} exited with code ${result.code}`);
        }
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
