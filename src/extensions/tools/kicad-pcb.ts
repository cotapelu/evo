#!/usr/bin/env node

/**
 * KiCad PCB Tool
 *
 * Super-tool for KiCad PCB layout operations using KiCad Python API.
 * Single-file tool with multiple sub-commands for full PCB workflow.
 */

import { Type } from "typebox";
import { ToolDefinition } from "@earendil-works/pi-coding-agent";

// ============================================================================
// Schemas
// ============================================================================

const plotSchema = Type.Object({
  input: Type.String(),
  output: Type.Optional(Type.String()),
  format: Type.Optional(Type.String()),
  layers: Type.Optional(Type.Array(Type.String())),
  drill: Type.Optional(Type.Boolean()),
  map: Type.Optional(Type.Boolean()),
});

const exportSchema = Type.Object({
  input: Type.String(),
  output: Type.Optional(Type.String()),
  format: Type.Optional(Type.String()),
});

const drcSchema = Type.Object({
  input: Type.String(),
  format: Type.Optional(Type.String()),
  severity: Type.Optional(Type.String()),
});

const fillZoneSchema = Type.Object({
  input: Type.String(),
  zone_id: Type.Optional(Type.String()),
  all: Type.Optional(Type.Boolean()),
});

const copperPourSchema = Type.Object({
  input: Type.String(),
  zone_id: Type.String(),
  clear: Type.Optional(Type.Boolean()),
});

const routeSchema = Type.Object({
  input: Type.String(),
  start: Type.String(),
  end: Type.String(),
  layer: Type.Optional(Type.String()),
});

const ratsnestSchema = Type.Object({
  input: Type.String(),
  optimize: Type.Optional(Type.Boolean()),
});

const drillSchema = Type.Object({
  input: Type.String(),
  output: Type.Optional(Type.String()),
  map: Type.Optional(Type.Boolean()),
});

const optimizeSchema = Type.Object({
  input: Type.String(),
  level: Type.Optional(Type.Number()),
});

const teardropsSchema = Type.Object({
  input: Type.String(),
  add: Type.Optional(Type.Boolean()),
  remove: Type.Optional(Type.Boolean()),
});

const zoneFillingSchema = Type.Object({
  input: Type.String(),
  fill_all: Type.Optional(Type.Boolean()),
});

const clearanceSchema = Type.Object({
  input: Type.String(),
  check_all: Type.Optional(Type.Boolean()),
});

const lengthTuningSchema = Type.Object({
  input: Type.String(),
  target_length: Type.Number(),
  tracks: Type.Array(Type.String()),
});

const fanoutSchema = Type.Object({
  input: Type.String(),
  component: Type.String(),
});

const glossSchema = Type.Object({
  input: Type.String(),
  level: Type.Optional(Type.Number()),
});

const swapSchema = Type.Object({
  input: Type.String(),
  item1: Type.String(),
  item2: Type.String(),
});

const tieSchema = Type.Object({
  input: Type.String(),
  pins: Type.Array(Type.String()),
});

const cleanSchema = Type.Object({
  input: Type.String(),
  remove_duplicates: Type.Optional(Type.Boolean()),
});

const inspectSchema = Type.Object({
  input: Type.String(),
  item: Type.String(),
});

const measureSchema = Type.Object({
  input: Type.String(),
  point1: Type.String(),
  point2: Type.String(),
});

const footprintSchema = Type.Object({
  input: Type.String(),
  footprint: Type.String(),
  action: Type.String(), // add, remove, edit
});

const padSchema = Type.Object({
  input: Type.String(),
  pad: Type.String(),
  action: Type.String(),
});

const viaSchema = Type.Object({
  input: Type.String(),
  via: Type.String(),
  action: Type.String(),
});

const trackSchema = Type.Object({
  input: Type.String(),
  track: Type.String(),
  action: Type.String(),
});

const zoneSchema = Type.Object({
  input: Type.String(),
  zone: Type.String(),
  action: Type.String(),
});

// ============================================================================
// Sub-command Registry
// ============================================================================

const subCommands: Record<string, { schema: any; description: string }> = {
  // Core PCB operations
  plot: { schema: plotSchema, description: "Plot PCB to gerber/other formats" },
  export: { schema: exportSchema, description: "Export PCB to 3D formats (STEP, IGES)" },
  drc: { schema: drcSchema, description: "Run PCB Design Rule Check" },
  fill_zone: { schema: fillZoneSchema, description: "Fill copper zones" },
  copper_pour: { schema: copperPourSchema, description: "Manage copper pour areas" },

  // Routing
  route: { schema: routeSchema, description: "Route tracks" },
  ratsnest: { schema: ratsnestSchema, description: "Optimize ratsnest" },

  // Manufacturing
  drill: { schema: drillSchema, description: "Generate drill files" },
  optimize: { schema: optimizeSchema, description: "Optimize PCB (copper clearance, etc)" },
  teardrops: { schema: teardropsSchema, description: "Add/remove teardrops" },
  zone_filling: { schema: zoneFillingSchema, description: "Fill all zones" },

  // Design rules
  clearance: { schema: clearanceSchema, description: "Check clearances" },
  length_tuning: { schema: lengthTuningSchema, description: "Tune track lengths" },
  fanout: { schema: fanoutSchema, description: "Generate component fanout" },
  gloss: { schema: glossSchema, description: "Glossy tracks/areas" },

  // Editing
  swap: { schema: swapSchema, description: "Swap items" },
  tie: { schema: tieSchema, description: "Tie nets together" },
  clean: { schema: cleanSchema, description: "Clean up PCB" },

  // Inspection
  inspect: { schema: inspectSchema, description: "Inspect item properties" },
  measure: { schema: measureSchema, description: "Measure distance between points" },

  // Object management
  footprint: { schema: footprintSchema, description: "Manage footprints" },
  pad: { schema: padSchema, description: "Manage pads" },
  via: { schema: viaSchema, description: "Manage vias" },
  track: { schema: trackSchema, description: "Manage tracks" },
  zone: { schema: zoneSchema, description: "Manage zones" },
};

// ============================================================================
// Generic Python executor
// ============================================================================

async function runKiCadPython(script: string, args: any, cwd: string, signal?: AbortSignal, onUpdate?: (update: any) => void) {
  const { spawn } = await import('child_process');
  const python = process.env.PYTHON || 'python3';

  const argArray: string[] = [];
  for (const [k, v] of Object.entries(args)) {
    if (v === true) argArray.push(`--${k}`);
    else if (v === false) continue;
    else if (Array.isArray(v)) {
      v.forEach(item => argArray.push(`--${k}`, String(item)));
    }
    else argArray.push(`--${k}`, String(v));
  }

  onUpdate?.({
    content: [{ type: "text", text: `Running: ${python} -m kicad.pcb.${script}` }],
    details: { script, args },
    isError: false
  });

  return new Promise((resolve, reject) => {
    const proc = spawn(python, ['-m', `kicad.pcb.${script}`, ...argArray], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(stderr || `Exit code ${code}`));
      }
    });

    proc.on('error', reject);

    signal?.addEventListener('abort', () => {
      proc.kill('SIGTERM');
    });
  });
}

// ============================================================================
// Tool Factory
// ============================================================================

export function createKicadPcbTool(): ToolDefinition<any, any> {
  return {
    name: "kicad_pcb",
    label: "KiCad PCB",
    description: "KiCad PCB layout operations. Uses KiCad Python API. Full coverage: plot, export, drc, fill_zone, copper_pour, route, ratsnest, drill, optimize, teardrops, zone_filling, clearance, length_tuning, fanout, gloss, swap, tie, clean, inspect, measure, footprint, pad, via, track, zone.",
    promptSnippet: "kicad_pcb({ command: '<cmd>', args: {...} })",
    promptGuidelines: [
      "kicad_pcb({ command: 'plot', args: { input: 'board.kicad_pcb', layers: ['F.Cu', 'B.Cu', 'F.SilkS'], drill: true } })",
      "kicad_pcb({ command: 'export', args: { input: 'board.kicad_pcb', format: 'step' } })",
      "kicad_pcb({ command: 'drc', args: { input: 'board.kicad_pcb', format: 'json' } })",
      "kicad_pcb({ command: 'fill_zone', args: { input: 'board.kicad_pcb', all: true } })",
      "kicad_pcb({ command: 'route', args: { input: 'board.kicad_pcb', start: 'U1-1', end: 'U2-1', layer: 'F.Cu' } })",
      "kicad_pcb({ command: 'drill', args: { input: 'board.kicad_pcb', map: true } })",
      "kicad_pcb({ command: 'optimize', args: { input: 'board.kicad_pcb' } })",
      "Commands: " + Object.keys(subCommands).join(', '),
      "Requires: kicad-python-api (pip install kicad)",
    ],
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", enum: Object.keys(subCommands), description: "Sub-command" },
        args: { type: "object", description: "Arguments for the sub-command" },
      },
      required: ["command", "args"],
    },
    async execute(_toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: any, ctx: any) {
      const { command, args } = params;
      if (!subCommands[command]) {
        return { content: [{ type: "text", text: `Unknown command: ${command}` }], details: null, isError: true } as const;
      }
      try {
        const cwd = ctx.session?.cwd ?? process.cwd();
        const result = await runKiCadPython(`pcb.${command}`, args, cwd, signal, onUpdate) as { stdout: string; stderr: string; code: number };
        return { content: [{ type: "text", text: result.stdout }], details: result, isError: false } as const;
      } catch (error: any) {
        return { content: [{ type: "text", text: `kicad_pcb ${command} error: ${error.message}` }], details: null, isError: true } as const;
      }
    }
  };
}

export function registerKicadPcbTool(api: import("@earendil-works/pi-coding-agent").ExtensionAPI): void {
  api.registerTool(createKicadPcbTool());
}
