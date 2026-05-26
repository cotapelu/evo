#!/usr/bin/env node

/**
 * KiCad Schematic Tool
 *
 * Super-tool for KiCad Schematic operations using KiCad Python API.
 * Single-file tool with multiple sub-commands.
 */

import { Type } from "typebox";
import { ToolDefinition } from "@earendil-works/pi-coding-agent";

// ============================================================================
// Schemas for each sub-command
// ============================================================================

const exportSchema = Type.Object({
  input: Type.String({ description: "Input .kicad_sch file" }),
  output: Type.Optional(Type.String()),
  format: Type.Optional(Type.String({ enum: ['pdf', 'png', 'svg', 'dxf'] })),
  black_and_white: Type.Optional(Type.Boolean()),
});

const plotSchema = Type.Object({
  input: Type.String(),
  output: Type.Optional(Type.String()),
  format: Type.Optional(Type.String()),
  layers: Type.Optional(Type.Array(Type.String())),
});

const diffSchema = Type.Object({
  file1: Type.String(),
  file2: Type.String(),
  output: Type.Optional(Type.String()),
});

const netlistSchema = Type.Object({
  input: Type.String(),
  output: Type.Optional(Type.String()),
  format: Type.Optional(Type.String()),
});

const ercSchema = Type.Object({
  input: Type.String(),
  format: Type.Optional(Type.String()),
  severity: Type.Optional(Type.String()),
});

const drcSchema = Type.Object({
  input: Type.String(),
  format: Type.Optional(Type.String()),
});

const annotateSchema = Type.Object({
  input: Type.String(),
  reset: Type.Optional(Type.Boolean()),
});

const symbolCheckSchema = Type.Object({
  input: Type.String(),
  library: Type.Optional(Type.String()),
});

const fieldEditSchema = Type.Object({
  input: Type.String(),
  field_name: Type.String(),
  field_value: Type.String(),
  edit_all: Type.Optional(Type.Boolean()),
});

const replaceFontsSchema = Type.Object({
  input: Type.String(),
  old_font: Type.String(),
  new_font: Type.String(),
});

const updateIdsSchema = Type.Object({
  input: Type.String(),
  dry_run: Type.Optional(Type.Boolean()),
});

// ============================================================================
// Sub-command Registry
// ============================================================================

const subCommands: Record<string, { schema: any; description: string }> = {
  export: { schema: exportSchema, description: "Export schematic to PDF/PNG/SVG/DXF" },
  plot: { schema: plotSchema, description: "Plot schematic with options" },
  diff: { schema: diffSchema, description: "Compare two schematics" },
  generate_netlist: { schema: netlistSchema, description: "Generate netlist" },
  erc: { schema: ercSchema, description: "Electrical Rule Check" },
  drc: { schema: drcSchema, description: "Design Rule Check (schematic level)" },
  annotate: { schema: annotateSchema, description: "Annotate reference designators" },
  symbol_check: { schema: symbolCheckSchema, description: "Check symbol validity" },
  field_edit: { schema: fieldEditSchema, description: "Edit component fields" },
  replace_fonts: { schema: replaceFontsSchema, description: "Replace fonts globally" },
  update_ids: { schema: updateIdsSchema, description: "Update component IDs" },
};

// ============================================================================
// Generic Python executor
// ============================================================================

async function runKiCadPython(script: string, args: any, cwd: string, signal?: AbortSignal, onUpdate?: (update: any) => void) {
  const { spawn } = await import('child_process');
  const python = process.env.PYTHON || 'python3';

  // Build args array
  const argArray: string[] = [];
  for (const [k, v] of Object.entries(args)) {
    if (v === true) argArray.push(`--${k}`);
    else if (v === false) continue;
    else argArray.push(`--${k}`, String(v));
  }

  onUpdate?.({
    content: [{ type: "text", text: `Running: ${python} -m kicad.${script}` }],
    details: { script, args },
    isError: false
  });

  return new Promise((resolve, reject) => {
    const proc = spawn(python, ['-m', `kicad.${script}`, ...argArray], {
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

export function createKicadSchTool(): ToolDefinition<any, any> {
  return {
    name: "kicad_sch",
    label: "KiCad Schematic",
    description: "KiCad Schematic operations. Uses KiCad Python API. Commands: export, plot, diff, generate_netlist, erc, drc, annotate, symbol_check, field_edit, replace_fonts, update_ids.",
    promptSnippet: "kicad_sch({ command: '<cmd>', args: {...} })",
    promptGuidelines: [
      "kicad_sch({ command: 'export', args: { input: 'schematic.kicad_sch', format: 'pdf' } })",
      "kicad_sch({ command: 'erc', args: { input: 'schematic.kicad_sch', format: 'json' } })",
      "kicad_sch({ command: 'drc', args: { input: 'schematic.kicad_sch' } })",
      "kicad_sch({ command: 'generate_netlist', args: { input: 'schematic.kicad_sch', format: 'kicad' } })",
      "kicad_sch({ command: 'annotate', args: { input: 'schematic.kicad_sch', reset: true } })",
      "kicad_sch({ command: 'field_edit', args: { input: 'schematic.kicad_sch', field_name: 'Value', field_value: '10k' } })",
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
        const result = await runKiCadPython(`sch.${command}`, args, cwd, signal, onUpdate) as { stdout: string; stderr: string; code: number };
        return { content: [{ type: "text", text: result.stdout }], details: result, isError: false } as const;
      } catch (error: any) {
        return { content: [{ type: "text", text: `kicad_sch ${command} error: ${error.message}` }], details: null, isError: true } as const;
      }
    }
  };
}

export function registerKicadSchTool(api: import("@earendil-works/pi-coding-agent").ExtensionAPI): void {
  api.registerTool(createKicadSchTool());
}
