#!/usr/bin/env node

/**
 * KiCad PCB Tool
 * All commands in one file
 */

import { Type } from "typebox";
import { ToolDefinition } from "@earendil-works/pi-coding-agent";

// ============================================================================
// Command Definitions
// ============================================================================

const plotCommand = {
  schema: Type.Object({
    input: Type.String(),
    output: Type.Optional(Type.String()),
    format: Type.Optional(Type.String()),
    layers: Type.Optional(Type.Array(Type.String())),
    drill: Type.Optional(Type.Boolean()),
    map: Type.Optional(Type.Boolean()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.plot', args.input];
    if (args.output) cmd.push('--output', args.output);
    if (args.format) cmd.push('--format', args.format);
    if (args.layers) ((args.layers) as string[]).forEach(l => cmd.push('--layer', l));
    if (args.drill) cmd.push('--drill');
    if (args.map) cmd.push('--map');
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

const exportCommand = {
  schema: Type.Object({
    input: Type.String(),
    output: Type.Optional(Type.String()),
    format: Type.Optional(Type.String()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.export', args.input];
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

const drcCommand = {
  schema: Type.Object({
    input: Type.String(),
    format: Type.Optional(Type.String()),
    severity: Type.Optional(Type.String()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.drc', args.input];
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

const fillZoneCommand = {
  schema: Type.Object({
    input: Type.String(),
    zone_id: Type.Optional(Type.String()),
    all: Type.Optional(Type.Boolean()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.fill_zone', args.input];
    if (args.zone_id) cmd.push('--zone-id', args.zone_id);
    if (args.all) cmd.push('--all');
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

const copperPourCommand = {
  schema: Type.Object({
    input: Type.String(),
    zone_id: Type.String(),
    clear: Type.Optional(Type.Boolean()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.copper_pour', args.input, '--zone-id', args.zone_id];
    if (args.clear) cmd.push('--clear');
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

const routeCommand = {
  schema: Type.Object({
    input: Type.String(),
    start: Type.String(),
    end: Type.String(),
    layer: Type.Optional(Type.String()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.route', args.input, '--start', args.start, '--end', args.end];
    if (args.layer) cmd.push('--layer', args.layer);
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

const ratsnestCommand = {
  schema: Type.Object({
    input: Type.String(),
    optimize: Type.Optional(Type.Boolean()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.ratsnest', args.input];
    if (args.optimize) cmd.push('--optimize');
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

const drillCommand = {
  schema: Type.Object({
    input: Type.String(),
    output: Type.Optional(Type.String()),
    map: Type.Optional(Type.Boolean()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.drill', args.input];
    if (args.output) cmd.push('--output', args.output);
    if (args.map) cmd.push('--map');
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

const optimizeCommand = {
  schema: Type.Object({
    input: Type.String(),
    level: Type.Optional(Type.Number()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.optimize', args.input];
    if (args.level != null) cmd.push('--level', String(args.level));
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

const teardropsCommand = {
  schema: Type.Object({
    input: Type.String(),
    add: Type.Optional(Type.Boolean()),
    remove: Type.Optional(Type.Boolean()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.teardrops', args.input];
    if (args.add) cmd.push('--add');
    if (args.remove) cmd.push('--remove');
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

const zoneFillingCommand = {
  schema: Type.Object({
    input: Type.String(),
    fill_all: Type.Optional(Type.Boolean()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.zone_filling', args.input];
    if (args.fill_all) cmd.push('--fill-all');
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

const clearanceCommand = {
  schema: Type.Object({
    input: Type.String(),
    check_all: Type.Optional(Type.Boolean()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.clearance', args.input];
    if (args.check_all) cmd.push('--check-all');
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

const lengthTuningCommand = {
  schema: Type.Object({
    input: Type.String(),
    target_length: Type.Number(),
    tracks: Type.Array(Type.String()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.length_tuning', args.input, '--target-length', String(args.target_length)];
    if (Array.isArray(args.tracks)) ((args.tracks) as string[]).forEach(t => cmd.push('--track', t));
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

const fanoutCommand = {
  schema: Type.Object({
    input: Type.String(),
    component: Type.String(),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.fanout', args.input, '--component', args.component];
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

const glossCommand = {
  schema: Type.Object({
    input: Type.String(),
    level: Type.Optional(Type.Number()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.gloss', args.input];
    if (args.level != null) cmd.push('--level', String(args.level));
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

const swapCommand = {
  schema: Type.Object({
    input: Type.String(),
    item1: Type.String(),
    item2: Type.String(),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.swap', args.input, '--item1', args.item1, '--item2', args.item2];
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

const tieCommand = {
  schema: Type.Object({
    input: Type.String(),
    pins: Type.Array(Type.String()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.tie', args.input];
    if (Array.isArray(args.pins)) ((args.pins) as string[]).forEach(p => cmd.push('--pin', p));
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

const cleanCommand = {
  schema: Type.Object({
    input: Type.String(),
    remove_duplicates: Type.Optional(Type.Boolean()),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.clean', args.input];
    if (args.remove_duplicates) cmd.push('--remove-duplicates');
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

const inspectCommand = {
  schema: Type.Object({
    input: Type.String(),
    item: Type.String(),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.inspect', args.input, '--item', args.item];
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

const measureCommand = {
  schema: Type.Object({
    input: Type.String(),
    point1: Type.String(),
    point2: Type.String(),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.measure', args.input, '--point1', args.point1, '--point2', args.point2];
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

const footprintCommand = {
  schema: Type.Object({
    input: Type.String(),
    footprint: Type.String(),
    action: Type.String(),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.footprint', args.input, '--footprint', args.footprint, '--action', args.action];
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

const padCommand = {
  schema: Type.Object({
    input: Type.String(),
    pad: Type.String(),
    action: Type.String(),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.pad', args.input, '--pad', args.pad, '--action', args.action];
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

const viaCommand = {
  schema: Type.Object({
    input: Type.String(),
    via: Type.String(),
    action: Type.String(),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.via', args.input, '--via', args.via, '--action', args.action];
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

const trackCommand = {
  schema: Type.Object({
    input: Type.String(),
    track: Type.String(),
    action: Type.String(),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.track', args.input, '--track', args.track, '--action', args.action];
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

const zoneCommand = {
  schema: Type.Object({
    input: Type.String(),
    zone: Type.String(),
    action: Type.String(),
  }),
  execute: async (args: any, cwd: string, signal?: AbortSignal, ctx?: any) => {
    const { spawn } = await import('child_process');
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.zone', args.input, '--zone', args.zone, '--action', args.action];
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
  plot: plotCommand,
  export: exportCommand,
  drc: drcCommand,
  fill_zone: fillZoneCommand,
  copper_pour: copperPourCommand,
  route: routeCommand,
  ratsnest: ratsnestCommand,
  drill: drillCommand,
  optimize: optimizeCommand,
  teardrops: teardropsCommand,
  zone_filling: zoneFillingCommand,
  clearance: clearanceCommand,
  length_tuning: lengthTuningCommand,
  fanout: fanoutCommand,
  gloss: glossCommand,
  swap: swapCommand,
  tie: tieCommand,
  clean: cleanCommand,
  inspect: inspectCommand,
  measure: measureCommand,
  footprint: footprintCommand,
  pad: padCommand,
  via: viaCommand,
  track: trackCommand,
  zone: zoneCommand,
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
      const cmd = (commands as any)[command];
      if (!cmd) {
        return { content: [{ type: "text", text: `Unknown command: ${command}. Use: ${Object.keys(commands).join(', ')}` }], details: null, isError: true } as const;
      }
      try {
        const cwd = ctx.session?.cwd ?? process.cwd();
        const result = await cmd.execute(args, cwd, signal, ctx, _onUpdate);
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
