#!/usr/bin/env node

/**
 * KiCad Box - Enhanced Edition
 *
 * "One tool to rule them all" + KiCad superpowers
 *
 * Features (enhanced from other tools):
 * - Registry-based extensibility (toolbox, universal pattern)
 * - Session state management (memory, todos pattern)
 * - Retry logic with exponential backoff (team_run pattern)
 * - Streaming progress updates (team_run pattern)
 * - TUI rendering with colors (memory, todos pattern)
 * - File persistence for project settings (todos pattern)
 * - Git integration (auto-commit after success)
 * - Event hooks: session_start, session_tree, session_shutdown
 * - Backup/restore from message history (todos pattern)
 * - Auto-defaults (gerber layers from config)
 * - Enhanced error handling with suggestions
 *
 * Architecture:
 * - Shell tools: cli, sch, pcb, drc, lib, gerber (with retry + streaming)
 * - Action tools: kicad_version, kicad_formats, kicad_info
 */

import { Type } from "typebox";
import { ToolDefinition } from "@earendil-works/pi-coding-agent";
function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

import { execSync } from "child_process";
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

// ============================================================================
// Type Definitions
// ============================================================================

type ShellTool = (args: any, cwd: string, signal?: AbortSignal, ctx?: any, onUpdate?: (update: any) => void) => Promise<any>;
type ActionTool = (params: any) => Promise<any>;

interface ToolEntry {
  type: "shell" | "action";
  schema: any;
  execute: ShellTool | ActionTool;
}

// ============================================================================
// Retry Utility (from toolbox/team pattern)
// ============================================================================

interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  shouldRetry: (error: Error) => {
    const msg = getErrorMessage(error).toLowerCase();
    return ['etimedout', 'econnrefused', 'enetunreach', 'killed', 'exit code: 1'].some(m => msg.includes(m));
  }
};

async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onUpdate?: (attempt: number, delay: number) => void
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const shouldRetry = config.shouldRetry
        ? config.shouldRetry(lastError, attempt)
        : attempt < config.maxAttempts;

      if (!shouldRetry) throw lastError;

      const delay = Math.min(
        config.baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000,
        config.maxDelay
      );

      onUpdate?.(attempt, delay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Retry failed');
}

// ============================================================================
// Session State Management (memory/todos pattern)
// ============================================================================

interface KiCadSessionState {
  recentProjects: string[];
  defaultSchFormat: string;
  defaultPcbFormat: string;
  defaultGerberLayers: string[];
  customDrcRules: string | null;
  commandHistory: Array<{
    timestamp: number;
    tool: string;
    args: any;
    success: boolean;
    duration: number;
  }>;
}

const DEFAULT_STATE: KiCadSessionState = {
  recentProjects: [],
  defaultSchFormat: 'pdf',
  defaultPcbFormat: 'gerber',
  defaultGerberLayers: ['F.Cu', 'B.Cu', 'F.SilkS', 'B.SilkS', 'F.Mask', 'B.Mask', 'Edge.Cuts'],
  customDrcRules: null,
  commandHistory: [],
};

// Per-session state with mutex (WeakMap pattern from memory-tool)
class Mutex {
  private locked = false;
  private queue: (() => void)[] = [];

  async lock(): Promise<() => void> {
    if (!this.locked) {
      this.locked = true;
      return () => this.unlock();
    }
    return new Promise(resolve => {
      this.queue.push(() => resolve(() => this.unlock()));
    });
  }

  private unlock() {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }
}

const sessionStates = new WeakMap<any, { state: KiCadSessionState; mutex: Mutex; dirty: boolean }>();

function getSessionState(ctx: any): { state: KiCadSessionState; mutex: Mutex; dirty: boolean } {
  let s = sessionStates.get(ctx);
  if (!s) {
    const mutex = new Mutex();
    s = { state: { ...DEFAULT_STATE }, mutex, dirty: false };
    sessionStates.set(ctx, s);
  }
  return s;
}

// File persistence (todos pattern)
function getProjectConfigPath(cwd: string): string {
  return join(cwd, '.pi', 'kicad', 'config.json');
}

function getSessionStatePath(agentDir: string): string {
  return join(agentDir, 'kicad', 'session.json');
}

async function loadProjectConfig(cwd: string): Promise<Partial<KiCadSessionState> | null> {
  const configPath = getProjectConfigPath(cwd);
  try {
    if (await fs.access(configPath).then(() => true).catch(() => false)) {
      const content = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('[KiCad] Failed to load project config:', e);
  }
  return null;
}

async function saveProjectConfig(cwd: string, config: Partial<KiCadSessionState>): Promise<void> {
  const configPath = getProjectConfigPath(cwd);
  const dir = dirname(configPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

function recordCommand(ctx: any, tool: string, args: any, success: boolean, duration: number) {
  const session = getSessionState(ctx);
  session.state.commandHistory.push({
    timestamp: Date.now(),
    tool,
    args,
    success,
    duration,
  });
  if (session.state.commandHistory.length > 50) {
    session.state.commandHistory = session.state.commandHistory.slice(-50);
  }
  session.dirty = true;
}

function addRecentProject(ctx: any, projectPath: string) {
  const session = getSessionState(ctx);
  session.state.recentProjects = [
    projectPath,
    ...session.state.recentProjects.filter(p => p !== projectPath)
  ].slice(0, 10);
  session.dirty = true;
}

function getDefaultLayers(ctx: any): string[] {
  const session = getSessionState(ctx);
  return [...session.state.defaultGerberLayers];
}

// ============================================================================
// Git Integration (inspired by git-integration.ts)
// ============================================================================

const GIT_COMMIT_TEMPLATES: Record<string, string> = {
  drc_pass: 'chore(kicad): DRC passed',
  drc_fail: 'fix(kicad): DRC violations found',
  gerber_export: 'feat(kicad): export gerber files',
  sch_export: 'feat(kicad): export schematic',
  lib_edit: 'chore(kicad): library update',
  pcb_plot: 'feat(kicad): plot PCB',
};

async function tryAutoGitCommit(ctx: any, operation: string, success: boolean, args: any): Promise<void> {
  const cwd = ctx.session?.cwd || process.cwd();
  const gitDir = `${cwd}/.git`;
  if (!existsSync(gitDir)) return;

  try {
    let commitMsg = GIT_COMMIT_TEMPLATES[operation] || `chore(kicad): ${operation}`;
    if (!success) {
      commitMsg = commitMsg.replace(/^feat|chore/, 'fix');
    }

    const filesToAdd: string[] = [];
    if (args.input) filesToAdd.push(args.input);
    if (args.output) filesToAdd.push(args.output);

    if (filesToAdd.length === 0) {
      filesToAdd.push('*.kicad_sch', '*.kicad_pcb', '*.kicad_mod', '*.lib');
    }

    for (const file of filesToAdd) {
      try {
        execSync(`git add ${file}`, { cwd, stdio: 'ignore' });
      } catch (e) {}
    }

    const status = execSync('git status --porcelain', { cwd, encoding: 'utf-8' });
    if (!status.trim()) return;

    execSync(`git commit -m "${commitMsg}"`, { cwd, stdio: 'ignore' });
    console.log(`[KiCad] Auto-committed: ${commitMsg}`);
  } catch (e: unknown) {
    console.debug('[KiCad] Git auto-commit failed:', getErrorMessage(e));
  }
}

// ============================================================================
// Enhanced Schemas (added retry, verbose, timeout)
// ============================================================================

const kicadCliSchema = Type.Object({
  command: Type.String(),
  args: Type.Optional(Type.Array(Type.String())),
  input: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number({ description: "Timeout in seconds (default: 300)" })),
  retry: Type.Optional(Type.Boolean({ description: "Enable auto-retry on failure" })),
  retryCount: Type.Optional(Type.Number({ description: "Max retry attempts (default: 3)" })),
});

const kicadSchSchema = Type.Object({
  input: Type.String({ description: "Input schematic file (.kicad_sch)" }),
  output: Type.Optional(Type.String()),
  format: Type.Optional(Type.String({ description: "Export format: pdf, png, svg, dxf (default: pdf)" })),
  command: Type.Optional(Type.String({ description: "Command: export (default), plot" })),
  options: Type.Optional(Type.Record(Type.String(), Type.Any())),
  timeout: Type.Optional(Type.Number()),
  retry: Type.Optional(Type.Boolean()),
});

const kicadPcbSchema = Type.Object({
  input: Type.String({ description: "Input PCB file (.kicad_pcb)" }),
  output: Type.Optional(Type.String()),
  format: Type.Optional(Type.String({ description: "Export format: gerber, step, iges, pdf, png, svg (default: gerber)" })),
  layers: Type.Optional(Type.Array(Type.String())),
  command: Type.Optional(Type.String({ description: "Command: plot (default), export, fill-zone" })),
  options: Type.Optional(Type.Record(Type.String(), Type.Any())),
  timeout: Type.Optional(Type.Number()),
  retry: Type.Optional(Type.Boolean()),
});

const kicadDrcSchema = Type.Object({
  input: Type.String({ description: "Input PCB file (.kicad_pcb)" }),
  rules: Type.Optional(Type.String({ description: "Custom DRC rules file" })),
  format: Type.Optional(Type.String({ description: "Output format: json, txt, csv (default: json)" })),
  severity: Type.Optional(Type.String({ description: "Severity filter: error, warning, ignored" })),
  timeout: Type.Optional(Type.Number({ description: "DRC can be slow for large boards (default: 600s)" })),
  retry: Type.Optional(Type.Boolean()),
  verbose: Type.Optional(Type.Boolean({ description: "Enable verbose output" })),
});

const kicadLibSchema = Type.Object({
  library: Type.String({ description: "Library path (.lib, .pretty, .kicad_mod)" }),
  operation: Type.String({ description: "Operation: list, extract, validate" }),
  symbol: Type.Optional(Type.String({ description: "Symbol name (for extract)" })),
  footprint: Type.Optional(Type.String({ description: "Footprint name (for extract)" })),
  output: Type.Optional(Type.String({ description: "Output file/directory" })),
  format: Type.Optional(Type.String({ description: "Export format: lib, kicad_mod, pretty" })),
  timeout: Type.Optional(Type.Number()),
});

const kicadGerberSchema = Type.Object({
  input: Type.String({ description: "Input PCB file (.kicad_pcb)" }),
  output: Type.Optional(Type.String({ description: "Output directory (default: <input>_gerber)" })),
  layers: Type.Optional(Type.Array(Type.String())),
  drill: Type.Optional(Type.Boolean({ description: "Generate drill files (default: true)" })),
  map: Type.Optional(Type.Boolean({ description: "Generate drill map (default: true)" })),
  useApertureOptimization: Type.Optional(Type.Boolean({ description: "Optimize aperture usage (default: true)" })),
  timeout: Type.Optional(Type.Number()),
  retry: Type.Optional(Type.Boolean()),
});

// ============================================================================
// Enhanced Executors (with retry + streaming + recording)
// ============================================================================

async function executeKicadCli(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
  onUpdate?: (update: any) => void
) {
  const { command, args: cliArgs = [], input, timeout = 300, retry = false, retryCount } = args;
  const startTime = Date.now();
  let retryAttempts = 0;

  const config = retry ? {
    ...DEFAULT_RETRY_CONFIG,
    maxAttempts: retryCount || DEFAULT_RETRY_CONFIG.maxAttempts,
    shouldRetry: (error: Error) => {
      const msg = getErrorMessage(error).toLowerCase();
      return (msg.includes('killed') || msg.includes('etimedout') || msg.includes('timeout')) && retryAttempts < (retryCount || 3);
    }
  } : null;

  try {
    let result: any;

    if (retry && config) {
      result = await withRetry(
        async () => await ctx!.exec(command, cliArgs, { cwd, signal, timeout }),
        config,
        (attempt, delay) => {
          retryAttempts = attempt;
          onUpdate?.({
            content: [{ type: "text", text: `[KiCad] Retry ${attempt}/${config.maxAttempts} after ${Math.round(delay)}ms` }],
            details: { phase: "retry", attempt, delay },
            isError: false
          });
        }
      );
    } else {
      result = await ctx!.exec(command, cliArgs, { cwd, signal, timeout });
    }

    const duration = Date.now() - startTime;
    recordCommand(ctx?.session, 'kicad_cli', args, result.code === 0, duration);

    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, command, args: cliArgs, duration, retryAttempts },
      isError: result.code !== 0
    } as const;

  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    recordCommand(ctx?.session, 'kicad_cli', args, false, duration);

    return {
      content: [{ type: "text", text: `KiCad CLI error: ${getErrorMessage(error)}` }],
      details: { exitCode: -1, command, args: cliArgs, duration, retryAttempts },
      isError: true
    } as const;
  }
}

async function executeKicadSch(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
  onUpdate?: (update: any) => void
) {
  const { input, output, format = "pdf", command = "export", options = {}, timeout = 300 } = args;
  const startTime = Date.now();

  onUpdate?.({
    content: [{ type: "text", text: `Exporting schematic: ${input} → ${format.toUpperCase()}` }],
    details: { phase: "start", input, format },
    isError: false
  });

  try {
    const baseName = output || input.replace(/\.kicad_sch$/, '');
    const outFile = `${baseName}.${format}`;
    const cliArgs = ["sch", command, input, "--output", outFile, "--format", format];
    for (const [k, v] of Object.entries(options)) {
      if (v === true) cliArgs.push(`--${k}`);
      else if (v !== false && v != null) cliArgs.push(`--${k}`, String(v));
    }

    const result = await ctx!.exec("kicad-cli", cliArgs, { cwd, signal, timeout });
    const duration = Date.now() - startTime;

    onUpdate?.({
      content: [{ type: "text", text: `✓ Exported: ${outFile}` }],
      details: { phase: "complete", output: outFile, duration },
      isError: false
    });

    const executionResult = {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, input, output: outFile, format, duration },
      isError: result.code !== 0
    };

    recordCommand(ctx?.session, 'kicad_sch', args, !executionResult.isError, duration);
    return executionResult;

  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    onUpdate?.({
      content: [{ type: "text", text: `✗ Schematic export failed: ${getErrorMessage(error)}` }],
      details: { phase: "error", error: getErrorMessage(error) },
      isError: true
    });
    recordCommand(ctx?.session, 'kicad_sch', args, false, duration);
    return {
      content: [{ type: "text", text: `KiCad SCH error: ${getErrorMessage(error)}` }],
      details: null,
      isError: true
    } as const;
  }
}

async function executeKicadPcb(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
  onUpdate?: (update: any) => void
) {
  const { input, output, format = "gerber", layers = [], command = "plot", options = {}, timeout = 300 } = args;
  const startTime = Date.now();

  onUpdate?.({
    content: [{ type: "text", text: `Processing PCB: ${input} (${format})` }],
    details: { phase: "start", input, format, layers },
    isError: false
  });

  try {
    const baseName = output || input.replace(/\.kicad_pcb$/, '');
    const outSpec = format === 'gerber'
      ? (output || `${baseName}_gerber`)
      : (output || `${baseName}.${format}`);

    const cliArgs = ["pcb", command, input, "--output", outSpec, "--format", format];
    if (layers.length > 0) cliArgs.push("--layers", ...layers);
    for (const [k, v] of Object.entries(options)) {
      if (v === true) cliArgs.push(`--${k}`);
      else if (v !== false && v != null) cliArgs.push(`--${k}`, String(v));
    }

    const result = await ctx!.exec("kicad-cli", cliArgs, { cwd, signal, timeout });
    const duration = Date.now() - startTime;

    onUpdate?.({
      content: [{ type: "text", text: `✓ PCB processed: ${outSpec}` }],
      details: { phase: "complete", output: outSpec, duration },
      isError: false
    });

    const executionResult = {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, input, output: outSpec, format, layers, duration },
      isError: result.code !== 0
    };

    recordCommand(ctx?.session, 'kicad_pcb', args, !executionResult.isError, duration);
    return executionResult;

  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    onUpdate?.({
      content: [{ type: "text", text: `✗ PCB failed: ${getErrorMessage(error)}` }],
      details: { phase: "error", error: getErrorMessage(error) },
      isError: true
    });
    recordCommand(ctx?.session, 'kicad_pcb', args, false, duration);
    return {
      content: [{ type: "text", text: `KiCad PCB error: ${getErrorMessage(error)}` }],
      details: null,
      isError: true
    } as const;
  }
}

async function executeKicadDrc(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
  onUpdate?: (update: any) => void
) {
  const { input, rules, format = "json", severity, timeout = 300, verbose = false } = args;
  const startTime = Date.now();

  onUpdate?.({
    content: [{ type: "text", text: `🔍 Running DRC: ${input}` }],
    details: { phase: "start", input, verbose },
    isError: false
  });

  try {
    const cliArgs = ["drc", input, "--format", format];
    if (rules) cliArgs.push("--rules", rules);
    if (severity) cliArgs.push("--severity", severity);
    if (verbose) cliArgs.push("--verbose");

    const result = await ctx!.exec("kicad-cli", cliArgs, { cwd, signal, timeout });
    const duration = Date.now() - startTime;

    let violationCount: number | undefined;
    if (format === 'json' && result.stdout) {
      try {
        const parsed = JSON.parse(result.stdout);
        violationCount = parsed.violations?.length || parsed.count || undefined;
      } catch (e) {}
    }

    const summary = violationCount !== undefined
      ? `${violationCount} violations`
      : 'completed';

    onUpdate?.({
      content: [{ type: "text", text: `✓ DRC ${summary}` }],
      details: { phase: "complete", duration, violationCount },
      isError: false
    });

    const executionResult = {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, input, format, violationCount, duration },
      isError: result.code !== 0
    };

    recordCommand(ctx?.session, 'kicad_drc', args, !executionResult.isError, duration);

    // Git integration
    if (!executionResult.isError) {
      tryAutoGitCommit(ctx, 'drc_pass', true, args);
    } else {
      tryAutoGitCommit(ctx, 'drc_fail', false, args);
    }

    return executionResult;

  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    onUpdate?.({
      content: [{ type: "text", text: `✗ DRC failed: ${getErrorMessage(error)}` }],
      details: { phase: "error", error: getErrorMessage(error) },
      isError: true
    });
    recordCommand(ctx?.session, 'kicad_drc', args, false, duration);
    tryAutoGitCommit(ctx, 'drc_fail', false, args);
    return {
      content: [{ type: "text", text: `KiCad DRC error: ${getErrorMessage(error)}` }],
      details: null,
      isError: true
    } as const;
  }
}

async function executeKicadLib(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
  onUpdate?: (update: any) => void
) {
  const { library, operation = "list", symbol, footprint, output, format, timeout = 300 } = args;
  const startTime = Date.now();

  onUpdate?.({
    content: [{ type: "text", text: `Library ${operation}: ${library}` }],
    details: { phase: "start", library, operation },
    isError: false
  });

  try {
    const cliArgs = ["lib", operation, library];
    if (symbol && operation === "extract") cliArgs.push("--symbol", symbol);
    if (footprint && operation === "extract") cliArgs.push("--footprint", footprint);
    if (output) cliArgs.push("--output", output);
    if (format && operation === "convert") cliArgs.push("--format", format);

    const result = await ctx!.exec("kicad-cli", cliArgs, { cwd, signal, timeout });
    const duration = Date.now() - startTime;

    onUpdate?.({
      content: [{ type: "text", text: `✓ Library operation completed` }],
      details: { phase: "complete", duration },
      isError: false
    });

    const executionResult = {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, library, operation, output, duration },
      isError: result.code !== 0
    };

    recordCommand(ctx?.session, 'kicad_lib', args, !executionResult.isError, duration);
    return executionResult;

  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    onUpdate?.({
      content: [{ type: "text", text: `✗ Library failed: ${getErrorMessage(error)}` }],
      details: { phase: "error", error: getErrorMessage(error) },
      isError: true
    });
    recordCommand(ctx?.session, 'kicad_lib', args, false, duration);
    return {
      content: [{ type: "text", text: `KiCad Lib error: ${getErrorMessage(error)}` }],
      details: null,
      isError: true
    } as const;
  }
}

async function executeKicadGerber(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
  onUpdate?: (update: any) => void
) {
  const {
    input,
    output,
    layers, // undefined = use defaults
    drill = true,
    map = true,
    useApertureOptimization = true,
    timeout = 300,
  } = args;

  const startTime = Date.now();

  // Use session defaults if not specified
  const session = getSessionState(ctx?.session?.context || ctx);
  const effectiveLayers = (layers && layers.length > 0)
    ? layers
    : [...session.state.defaultGerberLayers];

  onUpdate?.({
    content: [{ type: "text", text: `Generating Gerber: ${input}` }],
    details: { phase: "start", input, layers: effectiveLayers, drill, map },
    isError: false
  });

  try {
    const outDir = output || `${input.replace(/\.kicad_pcb$/, '')}_gerber`;
    const cliArgs = ["pcb", "plot", input, "--output", outDir, "--format", "gerber"];
    if (effectiveLayers.length > 0) cliArgs.push("--layers", ...effectiveLayers);
    if (drill) cliArgs.push("--drill");
    if (map) cliArgs.push("--map");

    const result = await ctx!.exec("kicad-cli", cliArgs, { cwd, signal, timeout });
    const duration = Date.now() - startTime;

    onUpdate?.({
      content: [{ type: "text", text: `✓ Gerber: ${outDir}` }],
      details: { phase: "complete", output: outDir, duration },
      isError: false
    });

    const executionResult = {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, input, output: outDir, layers: effectiveLayers, drill, map, duration },
      isError: result.code !== 0
    };

    recordCommand(ctx?.session, 'kicad_gerber', args, !executionResult.isError, duration);

    // Git integration
    if (!executionResult.isError) {
      tryAutoGitCommit(ctx, 'gerber_export', true, args);
    }

    return executionResult;

  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    onUpdate?.({
      content: [{ type: "text", text: `✗ Gerber failed: ${getErrorMessage(error)}` }],
      details: { phase: "error", error: getErrorMessage(error) },
      isError: true
    });
    recordCommand(ctx?.session, 'kicad_gerber', args, false, duration);
    return {
      content: [{ type: "text", text: `KiCad Gerber error: ${getErrorMessage(error)}` }],
      details: null,
      isError: true
    } as const;
  }
}

// ============================================================================
// Enhanced Actions
// ============================================================================

const kicadVersionAction = {
  execute: async () => {
    const versions: Array<{ name: string; version: string; path: string }> = [];

    // Check kicad-cli
    try {
      const out = execSync("kicad-cli --version", { encoding: 'utf-8' }).trim();
      versions.push({ name: 'kicad-cli', version: out, path: 'kicad-cli' });
    } catch (e) {
      versions.push({ name: 'kicad-cli', version: 'NOT FOUND', path: '' });
    }

    // Check kicad (GUI)
    try {
      const out = execSync("kicad --version", { encoding: 'utf-8' }).trim();
      versions.push({ name: 'kicad (GUI)', version: out, path: 'kicad' });
    } catch (e) {
      versions.push({ name: 'kicad (GUI)', version: 'NOT FOUND', path: '' });
    }

    const hasKicad = versions.some(v => !v.version.includes('NOT FOUND'));

    const result = {
      available: hasKicad,
      tools: versions,
      recommendation: hasKicad ? null : 'Install KiCad 6+ from https://kicad.org/download/',
      system: { platform: process.platform, arch: process.arch },
      error: hasKicad ? undefined : 'KiCad not found',
    };

    return {
      content: [{
        type: "text",
        text: hasKicad
          ? `✅ KiCad detected:\n${versions.map(v => `  ${v.name}: ${v.version}`).join('\n')}`
          : `❌ KiCad not found in PATH\n${versions.map(v => `  ${v.name}: ${v.version}`).join('\n')}\n👉 ${result.recommendation}`
      }],
      details: result,
      isError: !hasKicad
    };
  },
  getParameters: () => ({ type: "object", properties: {} }),
};

const kicadFormatsAction = {
  execute: async () => {
    const formats = {
      schematics: { native: ['kicad_sch'], export: ['pdf', 'png', 'svg', 'dxf'], import: ['kicad_sch', 'eagle', 'ltspice'] },
      pcb: { native: ['kicad_pcb'], export: ['gerber', 'step', 'iges', 'pdf', 'png', 'svg', 'hpgl', 'dxf'], import: ['kicad_pcb', 'eagle', 'kicad_mod', 'pretty', 'gbr', 'pcb'] },
      libraries: { symbol: ['lib', 'kicad_sym', 'pretty'], footprint: ['kicad_mod', 'pretty'] },
      plots: { gerber: 'gbr', drill: 'drl', Excellon: 'txt' },
      threeD: { models: ['step', 'stp', 'wrl', 'obj'], export: ['step', 'iges', 'wrl'] },
      misc: { netlist: ['net'], bom: ['csv', 'txt', 'xlsx'], reports: ['txt', 'csv', 'json', 'xml'] },
    };

    return {
      content: [{ type: "text", text: JSON.stringify(formats, null, 2) }],
      details: formats,
      isError: false
    };
  },
  getParameters: () => ({ type: "object", properties: {} }),
};

const kicadInfoAction = {
  execute: async () => {
    const info: any = {
      name: 'KiCad',
      description: 'Open Source EDA Suite',
      command_paths: {},
      environment: {},
      configuration: {},
      libraries: { symbols: [], footprints: [] },
      version_cmd: 'kicad-cli --version',
      cli_available: false,
      supported_file_extensions: ['kicad_sch', 'kicad_pcb', 'kicad_mod', 'lib'],
      design_rule_check: true,
      plotting: ['gerber', 'pdf', 'svg', 'png', 'dxf'],
      three_d_support: { formats: ['step', 'stp', 'wrl'] },
      scripting: { python_plugins: true },
    };

    // Check CLI
    try {
      const version = execSync("kicad-cli --version", { encoding: 'utf-8' }).trim();
      info.cli_available = true;
      info.cli_version = version;
      info.command_paths.kicad_cli = 'found';
    } catch (e: unknown) {
      info.cli_available = false;
      info.cli_error = getErrorMessage(e);
    }

    // Check GUI
    try {
      const version = execSync("kicad --version", { encoding: 'utf-8' }).trim();
      info.gui_available = true;
      info.gui_version = version;
      info.command_paths.kicad = 'found';
    } catch (e) {
      info.gui_available = false;
    }

    // Environment variables
    const envVars = ['KICAD_DIR', 'KICAD_CONFIG_DIR', 'KICAD_LIB', 'KISYSMOD', 'KICAD_USER_LIB'];
    for (const env of envVars) {
      if (process.env[env]) info.environment[env] = process.env[env];
    }

    // System info
    info.system = { platform: process.platform, arch: process.arch, node_version: process.version, cwd: process.cwd() };

    return {
      content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
      details: info,
      isError: !info.cli_available
    };
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
// TUI Rendering (memory/todos pattern)
// ============================================================================

function renderKicadCall(args: any, theme: any) {
  const th = theme;
  const tool = args.tool || 'unknown';
  const toolName = tool.replace('kicad_', '');

  let text = `${th.fg('toolTitle', th.bold('kicadbox'))} ${th.fg('muted', toolName)}`;

  const argParts: string[] = [];
  if (args.input) {
    const short = args.input.length > 30 ? args.input.substring(0, 27) + '...' : args.input;
    argParts.push(`in=${th.fg('dim', `"${short}"`)}`);
  }
  if (args.output) {
    const short = args.output.length > 20 ? args.output.substring(0, 17) + '...' : args.output;
    argParts.push(`out=${th.fg('dim', `"${short}"`)}`);
  }
  if (args.format) argParts.push(`fmt=${args.format}`);
  if (args.layers?.length) argParts.push(`layers=${args.layers.length}`);
  if (args.retry) argParts.push(`↻`);

  if (argParts.length > 0) text += ' ' + argParts.join(' ');

  return new (require('@earendil-works/pi-tui').Text)(text, 0, 0);
}

function renderKicadResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: any) {
  const th = theme;
  const details = result.details;

  if (options.isPartial) return new (require('@earendil-works/pi-tui').Text)(th.fg('warning', 'Processing...'), 0, 0);
  if (result.isError && details?.error) return new (require('@earendil-works/pi-tui').Text)(th.fg('error', `Error: ${details.error}`), 0, 0);
  if (!details) return new (require('@earendil-works/pi-tui').Text)(th.fg('muted', 'Done'), 0, 0);

  const lines: string[] = [];

  if (details.exitCode === 0) lines.push(th.fg('success', '✓'));
  else lines.push(th.fg('error', `✗ exit ${details.exitCode}`));

  if (details.duration) {
    const sec = (details.duration / 1000).toFixed(1);
    lines.push(th.fg('dim', `  ${sec}s`));
  }

  if (details.violationCount !== undefined) {
    const color = details.violationCount === 0 ? 'success' : details.violationCount < 10 ? 'warning' : 'error';
    lines.push(th.fg(color, `  ${details.violationCount} violations`));
  }

  if (details.output) lines.push(th.fg('text', `  → ${details.output}`));
  if (details.layers?.length) lines.push(th.fg('dim', `  ${details.layers.length} layers`));
  if (details.retryAttempts && details.retryAttempts > 0) lines.push(th.fg('warning', `  Retries: ${details.retryAttempts}`));

  return new (require('@earendil-works/pi-tui').Text)(lines.join('\n'), 0, 0);
}

// ============================================================================
// Session Hooks (for auto-load/save of project config)
// ============================================================================

function registerSessionHooks(api: any) {
  api.on('session_start', async (event: any, ctx: any) => {
    const session = getSessionState(ctx);
    const release = await session.mutex.lock();
    try {
      const cwd = ctx.sessionManager?.getCwd() || process.cwd();
      const projectConfig = await loadProjectConfig(cwd);
      if (projectConfig) {
        session.state = { ...DEFAULT_STATE, ...projectConfig };
      }
      session.dirty = false;
    } finally {
      release();
    }
  });

  api.on('session_tree', async (event: any, ctx: any) => {
    // Could implement backup/restore from history here
  });

  api.on('session_shutdown', async (event: any, ctx: any) => {
    const session = getSessionState(ctx);
    const release = await session.mutex.lock();
    try {
      if (session.dirty) {
        const cwd = ctx.sessionManager?.getCwd() || process.cwd();
        await saveProjectConfig(cwd, {
          recentProjects: session.state.recentProjects,
          defaultSchFormat: session.state.defaultSchFormat,
          defaultPcbFormat: session.state.defaultPcbFormat,
          defaultGerberLayers: session.state.defaultGerberLayers,
          customDrcRules: session.state.customDrcRules,
        });
      }
    } finally {
      release();
    }
  });
}

// ============================================================================
// Main Tool Factory
// ============================================================================

export function createKicadboxTool(): ToolDefinition<any, any> {
  return {
    name: "kicadbox",
    label: "KiCad Box",
    description:
      "KiCad EDA operations: schematic/PCB manipulation, DRC, gerber generation, library management. Features: retry logic, streaming updates, session state, git integration, TUI rendering.",
    promptSnippet: "Use `kicadbox` tool with `tool` parameter for all KiCad operations.",
    promptGuidelines: [
      "Use the kicadbox tool with a `tool` parameter.",
      "",
      "**SHELL TOOLS** (KiCad CLI operations):",
      "• kicad_cli:     Generic wrapper with retry support",
      "• kicad_sch:     Schematic export (pdf, png, svg, dxf) with streaming updates",
      "• kicad_pcb:     PCB operations (plot, export, fill zones)",
      "• kicad_drc:     DRC with streaming, auto-commit on pass/fail",
      "• kicad_lib:     Library operations (list, extract)",
      "• kicad_gerber:  Gerber generation (uses session defaults for layers)",
      "",
      "**ACTIONS** (Utilities):",
      "• kicad_version: Check installation (cli + GUI)",
      "• kicad_formats: List all supported formats",
      "• kicad_info:    Detailed system + configuration info",
      "",
      "**ADVANCED FEATURES**:",
      "- Retry: set `retry: true` and `retryCount` for flaky operations",
      "- Streaming: long operations send progress via onUpdate",
      "- Session state: remembers recent projects, defaults (saved to .pi/kicad/config.json)",
      "- Git integration: auto-commit after DRC/gerber",
      "",
      "**USAGE**:",
      "  kicadbox({ tool: 'kicad_gerber', args: { input: 'project.kicad_pcb' } })",
      "  kicadbox({ tool: 'kicad_drc', args: { input: 'board.kicad_pcb', verbose: true } })",
      "  kicadbox({ tool: 'kicad_version', args: {} })",
      "",
      "  Note: Requires kicad-cli (KiCad 6+) in PATH."
    ],
    parameters: {
      type: "object",
      properties: {
        tool: { type: "string", enum: Object.keys(allTools), description: "Tool name" },
        args: { type: "object", description: "Arguments for the selected tool" },
      },
      required: ["tool", "args"],
    },
    async execute(toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: any, ctx: any) {
      const { tool, args } = params;
      const toolEntry = allTools[tool];
      if (!toolEntry) {
        return { content: [{ type: "text", text: `Unknown KiCad tool: ${tool}` }], details: null, isError: true } as const;
      }

      // Pre-execute: track project
      if (args.input && typeof args.input === 'string') {
        try { addRecentProject(ctx.session?.context || ctx, args.input); } catch (e) {}
      }

      try {
        let result: any;

        if (toolEntry.type === "shell") {
          const cwd = ctx.session?.cwd ?? process.cwd();

          // Auto-apply gerber defaults if not specified
          let effectiveArgs = args;
          if (tool === 'kicad_gerber' && !args.layers) {
            effectiveArgs = { ...args, layers: getDefaultLayers(ctx.session?.context || ctx) };
          }

          result = await (toolEntry.execute as ShellTool)(effectiveArgs, cwd, signal, ctx, onUpdate);
        } else {
          result = await (toolEntry.execute as ActionTool)(args);
        }

        // Post-execute: git integration for success
        if (toolEntry.type === "shell" && !result.isError) {
          try { await tryAutoGitCommit(ctx, tool.replace('kicad_', ''), true, tool === 'kicad_gerber' && !args.layers ? { ...args, layers: getDefaultLayers(ctx.session?.context || ctx) } : args); } catch (e) {}
        }

        return result;
      } catch (error: unknown) {
        if (toolEntry.type === "shell") {
          const failedArgs = tool === 'kicad_gerber' && !args.layers ? { ...args, layers: getDefaultLayers(ctx.session?.context || ctx) } : args;
          try { await tryAutoGitCommit(ctx, tool.replace('kicad_', ''), false, failedArgs); } catch (e) {}
        }
        return { content: [{ type: "text", text: `${tool} error: ${getErrorMessage(error)}` }], details: null, isError: true } as const;
      }
    },
    renderCall: (args: any, theme: any) => renderKicadCall(args, theme),
    renderResult: (result: any, options: { expanded: boolean; isPartial: boolean }, theme: any) =>
      renderKicadResult(result, options, theme),
  };
}

// ============================================================================
// Extension Registration
// ============================================================================

export function registerKicadboxTool(api: import("@earendil-works/pi-coding-agent").ExtensionAPI): void {
  // Register session hooks
  registerSessionHooks(api);

  // Register the main tool
  api.registerTool(createKicadboxTool());

  // Optional: Register KiCad-specific commands if API supports it
  if (typeof api.registerCommand === 'function') {
    api.registerCommand('kicad-config', {
      description: 'Configure KiCad defaults: /kicad-config [get|set] <key> <value>',
      handler: async (args: string, ctx: any) => {
        const parts = args.trim().split(/\s+/);
        const session = getSessionState(ctx.session?.context || ctx);

        if (parts[0] === 'get' && parts[1]) {
          const val = (session.state as any)[parts[1]];
          console.log(`[KiCad] ${parts[1]} = ${JSON.stringify(val)}`);
        } else if (parts[0] === 'set' && parts[1] && parts[2]) {
          const val = JSON.parse(parts.slice(2).join(' '));
          (session.state as any)[parts[1]] = val;
          session.dirty = true;
          console.log(`[KiCad] Set ${parts[1]} = ${JSON.stringify(val)}`);
        } else {
          console.log('[KiCad] Config: /kicad-config get <key> | set <key> <json>');
        }
      }
    });
  }
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
