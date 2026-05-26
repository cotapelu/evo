#!/usr/bin/env node

/**
 * KiCad Schematic Tool
 * All commands in one file (pattern: subtool_loader simplified)
 */

import { Type } from "typebox";
import { ToolDefinition } from "@earendil-works/pi-coding-agent";

// ============================================================================
// Command Definitions
// ============================================================================

const exportCommand = {
  schema: Type.Object({
    input: Type.String(),
    output: Type.Optional(Type.String()),
    format: Type.Optional(Type.String()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.sch.export', args.input];
    if (args.output) cmd.push('--output', args.output);
    if (args.format) cmd.push('--format', args.format);
    return new Promise((resolve, reject) => {
      const p = spawn(python, cmd.slice(1), { cwd });
      let out = '', err = '';
      p.stdout.on('data', d => out += d.toString());
      p.stderr.on('data', d => err += d.toString());
      p.on('close', code => code === 0 ? resolve({ stdout: out, stderr: err, code }) : reject(new Error(err || `Exit ${code}`)));
      p.on('error', reject);
      signal?.addEventListener('abort', () => p.kill('SIGTERM'));
    });
  }
};

const plotCommand = {
  schema: Type.Object({
    input: Type.String(),
    output: Type.Optional(Type.String()),
    format: Type.Optional(Type.String()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.sch.plot', args.input];
    if (args.output) cmd.push('--output', args.output);
    if (args.format) cmd.push('--format', args.format);
    return new Promise((resolve, reject) => {
      const p = spawn(python, cmd.slice(1), { cwd });
      let out = '', err = '';
      p.stdout.on('data', d => out += d.toString());
      p.stderr.on('data', d => err += d.toString());
      p.on('close', code => code === 0 ? resolve({ stdout: out, stderr: err, code }) : reject(new Error(err || `Exit ${code}`)));
      p.on('error', reject);
      signal?.addEventListener('abort', () => p.kill('SIGTERM'));
    });
  }
};

const diffCommand = {
  schema: Type.Object({
    file1: Type.String(),
    file2: Type.String(),
    output: Type.Optional(Type.String()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.sch.diff', args.file1, args.file2];
    if (args.output) cmd.push('--output', args.output);
    return new Promise((resolve, reject) => {
      const p = spawn(python, cmd.slice(1), { cwd });
      let out = '', err = '';
      p.stdout.on('data', d => out += d.toString());
      p.stderr.on('data', d => err += d.toString());
      p.on('close', code => code === 0 ? resolve({ stdout: out, stderr: err, code }) : reject(new Error(err || `Exit ${code}`)));
      p.on('error', reject);
      signal?.addEventListener('abort', () => p.kill('SIGTERM'));
    });
  }
};

const netlistCommand = {
  schema: Type.Object({
    input: Type.String(),
    format: Type.Optional(Type.String()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.sch.generate_netlist', args.input];
    if (args.format) cmd.push('--format', args.format);
    return new Promise((resolve, reject) => {
      const p = spawn(python, cmd.slice(1), { cwd });
      let out = '', err = '';
      p.stdout.on('data', d => out += d.toString());
      p.stderr.on('data', d => err += d.toString());
      p.on('close', code => code === 0 ? resolve({ stdout: out, stderr: err, code }) : reject(new Error(err || `Exit ${code}`)));
      p.on('error', reject);
      signal?.addEventListener('abort', () => p.kill('SIGTERM'));
    });
  }
};

const ercCommand = {
  schema: Type.Object({
    input: Type.String(),
    format: Type.Optional(Type.String()),
    severity: Type.Optional(Type.String()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.sch.erc', args.input];
    if (args.format) cmd.push('--format', args.format);
    if (args.severity) cmd.push('--severity', args.severity);
    return new Promise((resolve, reject) => {
      const p = spawn(python, cmd.slice(1), { cwd });
      let out = '', err = '';
      p.stdout.on('data', d => out += d.toString());
      p.stderr.on('data', d => err += d.toString());
      p.on('close', code => code === 0 ? resolve({ stdout: out, stderr: err, code }) : reject(new Error(err || `Exit ${code}`)));
      p.on('error', reject);
      signal?.addEventListener('abort', () => p.kill('SIGTERM'));
    });
  }
};

const drcCommand = {
  schema: Type.Object({
    input: Type.String(),
    format: Type.Optional(Type.String()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.sch.drc', args.input];
    if (args.format) cmd.push('--format', args.format);
    return new Promise((resolve, reject) => {
      const p = spawn(python, cmd.slice(1), { cwd });
      let out = '', err = '';
      p.stdout.on('data', d => out += d.toString());
      p.stderr.on('data', d => err += d.toString());
      p.on('close', code => code === 0 ? resolve({ stdout: out, stderr: err, code }) : reject(new Error(err || `Exit ${code}`)));
      p.on('error', reject);
      signal?.addEventListener('abort', () => p.kill('SIGTERM'));
    });
  }
};

const annotateCommand = {
  schema: Type.Object({
    input: Type.String(),
    reset: Type.Optional(Type.Boolean()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.sch.annotate', args.input];
    if (args.reset) cmd.push('--reset');
    return new Promise((resolve, reject) => {
      const p = spawn(python, cmd.slice(1), { cwd });
      let out = '', err = '';
      p.stdout.on('data', d => out += d.toString());
      p.stderr.on('data', d => err += d.toString());
      p.on('close', code => code === 0 ? resolve({ stdout: out, stderr: err, code }) : reject(new Error(err || `Exit ${code}`)));
      p.on('error', reject);
      signal?.addEventListener('abort', () => p.kill('SIGTERM'));
    });
  }
};

const symbolCheckCommand = {
  schema: Type.Object({
    input: Type.String(),
    library: Type.Optional(Type.String()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.sch.symbol_check', args.input];
    if (args.library) cmd.push('--library', args.library);
    return new Promise((resolve, reject) => {
      const p = spawn(python, cmd.slice(1), { cwd });
      let out = '', err = '';
      p.stdout.on('data', d => out += d.toString());
      p.stderr.on('data', d => err += d.toString());
      p.on('close', code => code === 0 ? resolve({ stdout: out, stderr: err, code }) : reject(new Error(err || `Exit ${code}`)));
      p.on('error', reject);
      signal?.addEventListener('abort', () => p.kill('SIGTERM'));
    });
  }
};

const fieldEditCommand = {
  schema: Type.Object({
    input: Type.String(),
    field_name: Type.String(),
    field_value: Type.String(),
    edit_all: Type.Optional(Type.Boolean()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.sch.field_edit', args.input, '--field-name', args.field_name, '--field-value', args.field_value];
    if (args.edit_all) cmd.push('--edit-all');
    return new Promise((resolve, reject) => {
      const p = spawn(python, cmd.slice(1), { cwd });
      let out = '', err = '';
      p.stdout.on('data', d => out += d.toString());
      p.stderr.on('data', d => err += d.toString());
      p.on('close', code => code === 0 ? resolve({ stdout: out, stderr: err, code }) : reject(new Error(err || `Exit ${code}`)));
      p.on('error', reject);
      signal?.addEventListener('abort', () => p.kill('SIGTERM'));
    });
  }
};

const replaceFontsCommand = {
  schema: Type.Object({
    input: Type.String(),
    old_font: Type.String(),
    new_font: Type.String(),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.sch.replace_fonts', args.input, '--old-font', args.old_font, '--new-font', args.new_font];
    return new Promise((resolve, reject) => {
      const p = spawn(python, cmd.slice(1), { cwd });
      let out = '', err = '';
      p.stdout.on('data', d => out += d.toString());
      p.stderr.on('data', d => err += d.toString());
      p.on('close', code => code === 0 ? resolve({ stdout: out, stderr: err, code }) : reject(new Error(err || `Exit ${code}`)));
      p.on('error', reject);
      signal?.addEventListener('abort', () => p.kill('SIGTERM'));
    });
  }
};

const updateIdsCommand = {
  schema: Type.Object({
    input: Type.String(),
    dry_run: Type.Optional(Type.Boolean()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.sch.update_ids', args.input];
    if (args.dry_run) cmd.push('--dry-run');
    return new Promise((resolve, reject) => {
      const p = spawn(python, cmd.slice(1), { cwd });
      let out = '', err = '';
      p.stdout.on('data', d => out += d.toString());
      p.stderr.on('data', d => err += d.toString());
      p.on('close', code => code === 0 ? resolve({ stdout: out, stderr: err, code }) : reject(new Error(err || `Exit ${code}`)));
      p.on('error', reject);
      signal?.addEventListener('abort', () => p.kill('SIGTERM'));
    });
  }
};

const commands = {
  export: exportCommand,
  plot: plotCommand,
  diff: diffCommand,
  generate_netlist: netlistCommand,
  erc: ercCommand,
  drc: drcCommand,
  annotate: annotateCommand,
  symbol_check: symbolCheckCommand,
  field_edit: fieldEditCommand,
  replace_fonts: replaceFontsCommand,
  update_ids: updateIdsCommand,
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
      const cmd = (commands as any)[command];
      if (!cmd) {
        return { content: [{ type: "text", text: `Unknown command: ${command}. Use: ${Object.keys(commands).join(', ')}` }], details: null, isError: true } as const;
      }
      try {
        const cwd = ctx.session?.cwd ?? process.cwd();
        const result = await cmd.execute(args, cwd, signal, ctx, _onUpdate);
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
