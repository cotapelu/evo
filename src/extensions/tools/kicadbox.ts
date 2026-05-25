#!/usr/bin/env node

/**
 * KiCad Box - Unified tool for KiCad EDA operations
 *
 * Single-file implementation combining:
 * - Shell tools: KiCad CLI wrappers (sch, pcb, drc, lib, gerber)
 * - Action tools: KiCad utilities (version, formats, info)
 * Auto-detects mode based on tool name.
 */

import { Type } from "typebox";
import { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { execSync } from "child_process";

// ============================================================================
// Type Definitions
// ============================================================================

type ShellTool = (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => Promise<any>;
type ActionTool = (params: any) => Promise<any>;

interface ToolEntry {
  type: "shell" | "action";
  schema: any;
  execute: ShellTool | ActionTool;
}

// ============================================================================
// Shell Tools - Schemas
// ============================================================================

const kicadCliSchema = Type.Object({
  command: Type.String(),
  args: Type.Optional(Type.Array(Type.String())),
  input: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
});

const kicadSchSchema = Type.Object({
  input: Type.String(),
  output: Type.Optional(Type.String()),
  format: Type.Optional(Type.String()),
  command: Type.Optional(Type.String()),
  options: Type.Optional(Type.Record(Type.String(), Type.Any())),
});

const kicadPcbSchema = Type.Object({
  input: Type.String(),
  output: Type.Optional(Type.String()),
  format: Type.Optional(Type.String()),
  layers: Type.Optional(Type.Array(Type.String())),
  command: Type.Optional(Type.String()),
  options: Type.Optional(Type.Record(Type.String(), Type.Any())),
});

const kicadDrcSchema = Type.Object({
  input: Type.String(),
  rules: Type.Optional(Type.String()),
  format: Type.Optional(Type.String()),
  severity: Type.Optional(Type.String()),
});

const kicadLibSchema = Type.Object({
  library: Type.String(),
  operation: Type.String(),
  symbol: Type.Optional(Type.String()),
  footprint: Type.Optional(Type.String()),
  output: Type.Optional(Type.String()),
});

const kicadGerberSchema = Type.Object({
  input: Type.String(),
  output: Type.Optional(Type.String()),
  layers: Type.Optional(Type.Array(Type.String())),
  drill: Type.Optional(Type.Boolean()),
  map: Type.Optional(Type.Boolean()),
  format: Type.Optional(Type.String()),
  useApertureOptimization: Type.Optional(Type.Boolean()),
});

// ============================================================================
// Shell Tools - Executors
// ============================================================================

async function executeKicadCli(args: any, cwd: string, signal?: AbortSignal, ctx?: any) {
  const { command, args: cliArgs = [], input, timeout = 300 } = args;
  try {
    const result = await ctx!.exec(command, cliArgs, { cwd, signal, timeout });
    return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed, command, args: cliArgs }, isError: result.code !== 0 } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `KiCad CLI error: ${error.message}` }], details: null, isError: true } as const;
  }
}

async function executeKicadSch(args: any, cwd: string, signal?: AbortSignal, ctx?: any) {
  const { input, output, format = "pdf", command = "export", options = {} } = args;
  try {
    const baseName = output || input.replace(/\.kicad_sch$/, '');
    const outFile = `${baseName}.${format}`;
    const cliArgs = ["sch", command, input, "--output", outFile, "--format", format];
    for (const [k, v] of Object.entries(options)) {
      if (v === true) cliArgs.push(`--${k}`);
      else if (v !== false && v != null) cliArgs.push(`--${k}`, String(v));
    }
    const result = await ctx!.exec("kicad-cli", cliArgs, { cwd, signal });
    return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed, input, output: outFile, format }, isError: result.code !== 0 } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `KiCad SCH error: ${error.message}` }], details: null, isError: true } as const;
  }
}

async function executeKicadPcb(args: any, cwd: string, signal?: AbortSignal, ctx?: any) {
  const { input, output, format = "gerber", layers = [], command = "plot", options = {} } = args;
  try {
    const baseName = output || input.replace(/\.kicad_pcb$/, '');
    // For gerber format, output is a directory; for others, it's a file
    const outSpec = format === 'gerber'
      ? (output || `${baseName}_gerber`)
      : (output || `${baseName}.${format}`);
    const cliArgs = ["pcb", command, input, "--output", outSpec, "--format", format];
    if (layers.length > 0) cliArgs.push("--layers", ...layers);
    for (const [k, v] of Object.entries(options)) {
      if (v === true) cliArgs.push(`--${k}`);
      else if (v !== false && v != null) cliArgs.push(`--${k}`, String(v));
    }
    const result = await ctx!.exec("kicad-cli", cliArgs, { cwd, signal });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, input, output: outSpec, format, layers },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `KiCad PCB error: ${error.message}` }],
      details: null,
      isError: true,
    } as const;
  }
}

async function executeKicadDrc(args: any, cwd: string, signal?: AbortSignal, ctx?: any) {
  const { input, rules, format = "json", severity } = args;
  try {
    const cliArgs = ["drc", input, "--format", format];
    if (rules) cliArgs.push("--rules", rules);
    if (severity) cliArgs.push("--severity", severity);
    const result = await ctx!.exec("kicad-cli", cliArgs, { cwd, signal });
    return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed, input, format }, isError: result.code !== 0 } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `KiCad DRC error: ${error.message}` }], details: null, isError: true } as const;
  }
}

async function executeKicadLib(args: any, cwd: string, signal?: AbortSignal, ctx?: any) {
  const { library, operation = "list", symbol, footprint, output } = args;
  try {
    const cliArgs = ["lib", operation, library];
    if (symbol && operation === "extract") cliArgs.push("--symbol", symbol);
    if (footprint && operation === "extract") cliArgs.push("--footprint", footprint);
    if (output) cliArgs.push("--output", output);
    const result = await ctx!.exec("kicad-cli", cliArgs, { cwd, signal });
    return { content: [{ type: "text", text: result.stdout || result.stderr }], details: { exitCode: result.code, killed: result.killed, library, operation }, isError: result.code !== 0 } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `KiCad Lib error: ${error.message}` }], details: null, isError: true } as const;
  }
}

async function executeKicadGerber(args: any, cwd: string, signal?: AbortSignal, ctx?: any) {
  const {
    input,
    output,
    layers = ["F.Cu", "B.Cu", "F.SilkS", "B.SilkS", "F.Mask", "B.Mask", "Edge.Cuts"],
    drill = true,
    map = true,
  } = args;
  try {
    const outDir = output || `${input.replace(/\.kicad_pcb$/, '')}_gerber`;
    const cliArgs = ["pcb", "plot", input, "--output", outDir, "--format", "gerber"];
    if (layers.length > 0) cliArgs.push("--layers", ...layers);
    if (drill) cliArgs.push("--drill");
    if (map) cliArgs.push("--map");
    const result = await ctx!.exec("kicad-cli", cliArgs, { cwd, signal });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, input, output: outDir, layers, drill, map },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `KiCad Gerber error: ${error.message}` }], details: null, isError: true } as const;
  }
}

// ============================================================================
// Action Tools
// ============================================================================

const kicadVersionAction = {
  execute: async () => {
    try {
      const version = execSync("kicad-cli --version", { encoding: 'utf-8' }).trim();
      return { content: [{ type: "text", text: `KiCad version: ${version}` }], details: { version, source: 'kicad-cli' }, isError: false } as const;
    } catch (e: any) {
      try {
        const version = execSync("kicad --version", { encoding: 'utf-8' }).trim();
        return { content: [{ type: "text", text: `KiCad version: ${version}` }], details: { version, source: 'kicad' }, isError: false } as const;
      } catch (e2: any) {
        return { content: [{ type: "text", text: `KiCad not found in PATH` }], details: { error: e2.message, suggestion: 'Install KiCad 6+ or ensure kicad-cli is in PATH' }, isError: true } as const;
      }
    }
  },
  getParameters: () => ({ type: "object", properties: {} }),
};

const kicadFormatsAction = {
  execute: async () => {
    const formats = {
      schematics: { native: ['kicad_sch'], export: ['pdf', 'png', 'svg', 'dxf'] },
      pcb: { native: ['kicad_pcb'], export: ['gerber', 'step', 'iges', 'pdf', 'png', 'svg'] },
      libraries: { footprint: ['kicad_mod'], symbol: ['lib'] },
      plots: { gerber: 'gbr', drill: 'drl' }
    };
    return { content: [{ type: "text", text: JSON.stringify(formats, null, 2) }], details: formats, isError: false } as const;
  },
  getParameters: () => ({ type: "object", properties: {} }),
};

const kicadInfoAction = {
  execute: async () => {
    const info = {
      name: 'KiCad',
      description: 'Open Source EDA Suite',
      version_cmd: 'kicad-cli --version',
      cli_available: true,
      supported_file_extensions: ['kicad_sch', 'kicad_pcb', 'kicad_mod', 'lib'],
      design_rule_check: true,
      plotting: ['gerber', 'pdf', 'svg', 'png', 'dxf'],
      '3d_support': { formats: ['step', 'stp', 'wrl'] },
      scripting: { python_plugins: true }
    };
    return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }], details: info, isError: false } as const;
  },
  getParameters: () => ({ type: "object", properties: {} }),
};

// ============================================================================
// Tool Registry
// ============================================================================

const allTools: Record<string, ToolEntry> = {
  // Shell tools
  kicad_cli: { type: "shell", schema: kicadCliSchema, execute: executeKicadCli },
  kicad_sch: { type: "shell", schema: kicadSchSchema, execute: executeKicadSch },
  kicad_pcb: { type: "shell", schema: kicadPcbSchema, execute: executeKicadPcb },
  kicad_drc: { type: "shell", schema: kicadDrcSchema, execute: executeKicadDrc },
  kicad_lib: { type: "shell", schema: kicadLibSchema, execute: executeKicadLib },
  kicad_gerber: { type: "shell", schema: kicadGerberSchema, execute: executeKicadGerber },
  // Action tools
  kicad_version: { type: "action", schema: kicadVersionAction.getParameters?.() || {}, execute: kicadVersionAction.execute },
  kicad_formats: { type: "action", schema: kicadFormatsAction.getParameters?.() || {}, execute: kicadFormatsAction.execute },
  kicad_info: { type: "action", schema: kicadInfoAction.getParameters?.() || {}, execute: kicadInfoAction.execute },
};

// ============================================================================
// Tool Factory
// ============================================================================

export function createKicadboxTool(): ToolDefinition<any, any> {
  return {
    name: "kicadbox",
    label: "KiCad Box",
    description:
      "Unified tool for KiCad EDA operations. Includes schematic/PCB manipulation, DRC, gerber generation, library management, and KiCad utilities.",
    promptSnippet: "Use `kicadbox` tool with `tool` parameter for all KiCad operations.",
    promptGuidelines: [
      "Use the kicadbox tool with a `tool` parameter.",
      "",
      "**SHELL TOOLS** (KiCad CLI operations):",
      "• kicad_cli:     Generic KiCad CLI wrapper",
      "• kicad_sch:     Schematic operations (export to PDF/PNG/SVG/DXF)",
      "• kicad_pcb:     PCB operations (plot, export, fill zones)",
      "• kicad_drc:     Design Rule Check",
      "• kicad_lib:     Library operations (list, extract symbols/footprints)",
      "• kicad_gerber:  Gerber file generation",
      "",
      "**ACTIONS** (KiCad utilities):",
      "• kicad_version: Get KiCad version",
      "• kicad_formats: List supported file formats",
      "• kicad_info:    Get KiCad system info",
      "",
      "**USAGE**:",
      "  kicadbox({ tool: 'kicad_gerber', args: { input: 'project.kicad_pcb', layers: ['F.Cu', 'B.Cu'] } })",
      "  kicadbox({ tool: 'kicad_drc', args: { input: 'board.kicad_pcb' } })",
      "  kicadbox({ tool: 'kicad_version', args: {} })",
      "",
      "  Note: Requires kicad-cli (KiCad 6+) in PATH.",
    ],
    parameters: {
      type: "object",
      properties: {
        tool: { type: "string", enum: Object.keys(allTools), description: "Tool name" },
        args: { type: "object", description: "Arguments for the selected tool" },
      },
      required: ["tool", "args"],
    },
    async execute(_toolCallId: string, params: any, signal: AbortSignal | undefined, _onUpdate: any, ctx: any) {
      const { tool, args } = params;
      const toolEntry = allTools[tool];
      if (!toolEntry) {
        return { content: [{ type: "text", text: `Unknown KiCad tool: ${tool}` }], details: null, isError: true } as const;
      }
      try {
        if (toolEntry.type === "shell") {
          const cwd = ctx.session?.cwd ?? process.cwd();
          const result = await (toolEntry.execute as ShellTool)(args, cwd, signal, ctx);
          return result;
        } else {
          const result = await (toolEntry.execute as ActionTool)(args);
          return result;
        }
      } catch (error: any) {
        return { content: [{ type: "text", text: `${tool} error: ${error.message}` }], details: null, isError: true } as const;
      }
    },
  };
}

// ============================================================================
// Extension Registration
// ============================================================================

export function registerKicadboxTool(api: import("@earendil-works/pi-coding-agent").ExtensionAPI): void {
  api.registerTool(createKicadboxTool());
}

// ============================================================================
// Utilities
// ============================================================================

export function getAvailableKicadTools(): string[] {
  return Object.keys(allTools);
}

export function getKicadToolInfo(name: string): { type: "shell" | "action"; schema: any } | null {
  const entry = allTools[name];
  if (!entry) return null;
  return { type: entry.type, schema: entry.schema };
}
