#!/usr/bin/env node

/**
 * Toolbox - Unified tool combining shell operations and pure actions
 *
 * Philosophy: "One tool to rule them all"
 * - Shell tools: File ops (ls, find, grep, read) + HTTP (curl wrapper)
 * - Action tools: System utilities (echo, date, uuid, random, calc, sysinfo)
 * - Auto-detection: Determines execution mode based on tool name
 * - Extensible: Easy to add new tools of either type
 *
 * This is a hybrid of subtool_loader (dispatcher) and universal (registry).
 */

import { Type } from "typebox";
import { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { platform, arch, release, uptime, totalmem, freemem, cpus } from "os";
import { randomUUID } from "crypto";

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
// Shell Tools Schemas & Executors
// ============================================================================

const lsSchema = Type.Object({
  path: Type.Optional(Type.String()),
  recursive: Type.Optional(Type.Boolean()),
  all: Type.Optional(Type.Boolean()),
});

async function executeLs(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { path, recursive = false, all = false } = args as { path?: string; recursive?: boolean; all?: boolean };
  try {
    const lsArgs: string[] = [];
    if (all) lsArgs.push("-la");
    else if (recursive) lsArgs.push("-lR");
    else if (path) lsArgs.push("-l", path);
    else lsArgs.push("-l");

    const targetPath = path || cwd;
    const result = await ctx!.exec("ls", lsArgs, { cwd: targetPath, signal });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, path: targetPath },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `ls error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}

const findSchema = Type.Object({
  path: Type.Optional(Type.String()),
  pattern: Type.String({ description: "Glob pattern (e.g., '*.ts', '**/*.js')" }),
  maxDepth: Type.Optional(Type.Number()),
});

async function executeFind(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { pattern, path = cwd, maxDepth } = args as { pattern: string; path?: string; maxDepth?: number };
  try {
    const findArgs: string[] = [path];
    if (maxDepth) findArgs.push("-maxdepth", String(maxDepth));
    findArgs.push("-name", pattern);

    const result = await ctx!.exec("find", findArgs, { cwd, signal });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, pattern, path },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `find error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}

const grepSchema = Type.Object({
  pattern: Type.String({ description: "Search pattern (regex)" }),
  path: Type.Optional(Type.String()),
  include: Type.Optional(Type.String()),
  exclude: Type.Optional(Type.String()),
  ignoreCase: Type.Optional(Type.Boolean()),
});

async function executeGrep(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { pattern, path = cwd, include, exclude, ignoreCase = false } = args as {
    pattern: string;
    path?: string;
    include?: string;
    exclude?: string;
    ignoreCase?: boolean;
  };
  try {
    const grepArgs: string[] = [];
    if (ignoreCase) grepArgs.push("-i");
    if (include) grepArgs.push("--include", include);
    if (exclude) grepArgs.push("--exclude", exclude);
    grepArgs.push("-r");
    grepArgs.push(pattern);

    const result = await ctx!.exec("grep", grepArgs, { cwd: path || cwd, signal });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, pattern, path: path || cwd },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `grep error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}

const readSchema = Type.Object({
  path: Type.String({ description: "File path to read" }),
  offset: Type.Optional(Type.Number()),
  limit: Type.Optional(Type.Number()),
});

async function executeRead(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const { path, offset, limit } = args as { path: string; offset?: number; limit?: number };
  try {
    let cmd = `cat '${path}'`;
    if (offset && offset > 0) cmd += ` | tail -n +${offset}`;
    if (limit !== undefined) cmd += ` | head -n ${limit}`;

    const result = await ctx!.exec("bash", ["-c", cmd], { cwd, signal });
    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, path, offset, limit },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `read error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}

const httpSchema = Type.Object({
  method: Type.Optional(Type.String({ description: "GET, POST, PUT, DELETE, PATCH (default: GET)" })),
  url: Type.String({ description: "URL to request" }),
  headers: Type.Optional(Type.Record(Type.String(), Type.String())),
  body: Type.Optional(Type.Any({ description: "Request body (will be JSON stringified if object)" })),
  timeout: Type.Optional(Type.Number({ description: "Timeout in seconds (default: 30)" })),
  insecure: Type.Optional(Type.Boolean()),
  user: Type.Optional(Type.String()),
  verbose: Type.Optional(Type.Boolean()),
});

async function executeHttp(
  args: any,
  cwd: string,
  signal?: AbortSignal,
  ctx?: any,
) {
  const {
    method = "GET",
    url,
    headers = {},
    body,
    timeout = 30,
    insecure = false,
    user,
    verbose = false,
  } = args as {
    method?: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;
    insecure?: boolean;
    user?: string;
    verbose?: boolean;
  };

  try {
    const curlArgs: string[] = [];

    if (method !== "GET") curlArgs.push("-X", method);

    for (const [key, value] of Object.entries(headers)) {
      curlArgs.push("-H", `${key}: ${value}`);
    }

    let tempFilePath: string | null = null;
    if (body && ["POST", "PUT", "PATCH"].includes(method)) {
      const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
      tempFilePath = `${tmpdir()}/curl-data-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
      await fs.writeFile(tempFilePath, bodyStr, "utf8");
      curlArgs.push("--data", `@${tempFilePath}`);
    }

    curlArgs.push("--max-time", String(timeout));

    if (insecure) curlArgs.push("-k");
    if (user) curlArgs.push("-u", user);
    if (verbose) curlArgs.push("-v");

    curlArgs.push(url);

    const result = await ctx!.exec("curl", curlArgs, { cwd, signal });

    if (tempFilePath) {
      try { await fs.unlink(tempFilePath); } catch (e) {}
    }

    return {
      content: [{ type: "text", text: result.stdout || result.stderr }],
      details: { exitCode: result.code, killed: result.killed, url, method },
      isError: result.code !== 0,
    } as const;
  } catch (error: any) {
    return { content: [{ type: "text", text: `HTTP error: ${error.message}` }], details: undefined, isError: true } as const;
  }
}

// ============================================================================
// Action Tools
// ============================================================================

const echoAction = {
  execute: async (params: { message?: string }) => {
    if (!params.message) {
      throw new Error("Missing required parameter 'message' for echo action");
    }
    return {
      content: [{ type: "text", text: `Echo: ${params.message}` }],
      details: params.message,
      isError: false,
    } as const;
  },
  getParameters: () => ({
    type: "object",
    properties: {
      message: { type: "string", description: "Message to echo back" },
    },
    required: ["message"],
  }),
};

const systemInfoAction = {
  execute: async () => {
    const cpuInfo = cpus();
    const result = {
      platform: platform(),
      arch: arch(),
      osRelease: release(),
      nodeVersion: process.version,
      uptime: uptime(),
      totalMemoryMB: Math.round(totalmem() / 1024 / 1024),
      freeMemoryMB: Math.round(freemem() / 1024 / 1024),
      cpuCores: cpuInfo.length,
      cpuModel: cpuInfo[0]?.model || "unknown",
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      details: result,
      isError: false,
    } as const;
  },
  getParameters: () => ({ type: "object", properties: {} }),
};

const dateAction = {
  execute: async () => {
    const now = new Date();
    return {
      content: [
        { type: "text", text: `Current date/time: ${now.toISOString()}` },
        { type: "text", text: `Human readable: ${now.toLocaleString()}` }
      ],
      details: { iso: now.toISOString(), timestamp: now.getTime(), locale: now.toLocaleString() },
      isError: false,
    } as const;
  },
  getParameters: () => ({ type: "object", properties: {} }),
};

const uuidAction = {
  execute: async () => {
    const uuid = randomUUID();
    return {
      content: [{ type: "text", text: `Generated UUID: ${uuid}` }],
      details: { uuid },
      isError: false,
    } as const;
  },
  getParameters: () => ({ type: "object", properties: {} }),
};

const randomAction = {
  execute: async (params: { min?: number; max?: number }) => {
    const min = params.min ?? 0;
    const max = params.max ?? 100;
    const num = Math.floor(Math.random() * (max - min + 1)) + min;
    return {
      content: [{ type: "text", text: `Random number: ${num} (range: ${min}-${max})` }],
      details: { value: num, min, max },
      isError: false,
    } as const;
  },
  getParameters: () => ({
    type: "object",
    properties: {
      min: { type: "number", description: "Minimum value (inclusive, default: 0)" },
      max: { type: "number", description: "Maximum value (inclusive, default: 100)" }
    },
    required: [],
  }),
};

const calcAction = {
  execute: async (params: { expression: string }) => {
    const expr = params.expression.replace(/\s/g, '');
    if (!/^[0-9+\-*/().]+$/.test(expr)) {
      throw new Error('Invalid expression. Only numbers and operators (+, -, *, /) allowed.');
    }
    // eslint-disable-next-line no-eval
    const result = eval(expr);
    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
      throw new Error('Invalid calculation result');
    }
    return {
      content: [{ type: "text", text: `${params.expression} = ${result}` }],
      details: { expression: params.expression, result },
      isError: false,
    } as const;
  },
  getParameters: () => ({
    type: "object",
    properties: {
      expression: { type: "string", description: "Math expression to evaluate (e.g., '2 + 3 * 4')" }
    },
    required: ['expression'],
  }),
};

// ============================================================================
// Tool Registry
// ============================================================================

const allTools: Record<string, ToolEntry> = {
  // Shell tools
  ls: { type: "shell", schema: lsSchema, execute: executeLs },
  find: { type: "shell", schema: findSchema, execute: executeFind },
  grep: { type: "shell", schema: grepSchema, execute: executeGrep },
  read: { type: "shell", schema: readSchema, execute: executeRead },
  http: { type: "shell", schema: httpSchema, execute: executeHttp },
  // Action tools
  echo: { type: "action", schema: echoAction.getParameters?.() || {}, execute: echoAction.execute },
  system_info: { type: "action", schema: systemInfoAction.getParameters?.() || {}, execute: systemInfoAction.execute },
  date: { type: "action", schema: dateAction.getParameters?.() || {}, execute: dateAction.execute },
  uuid: { type: "action", schema: uuidAction.getParameters?.() || {}, execute: uuidAction.execute },
  random: { type: "action", schema: randomAction.getParameters?.() || {}, execute: randomAction.execute },
  calc: { type: "action", schema: calcAction.getParameters?.() || {}, execute: calcAction.execute },
};

// ============================================================================
// Tool Factory
// ============================================================================

export function createToolboxTool(): ToolDefinition<any, any> {
  return {
    name: "toolbox",
    label: "Toolbox",
    description:
      "Unified tool combining shell operations (ls, find, grep, read, http) and pure actions (echo, date, uuid, random, calc, system_info). Auto-detects execution mode. Extensible registry for both types.",
    promptSnippet:
      "Use `toolbox` tool with `tool` parameter to access combined shell + action operations.",
    promptGuidelines: [
      "Use the toolbox tool with a `tool` parameter.",
      "",
      "**SHELL TOOLS** (file operations + HTTP):",
      "• ls:      List directory contents (ls -la, -lR, or specific path)",
      "• find:    Find files by glob pattern (e.g., '**.ts')",
      "• grep:    Search file contents recursively with filters",
      "• read:    Read file with optional offset/limit",
      "• http:    HTTP requests (curl wrapper) with full options",
      "",
      "**ACTIONS** (system utilities):",
      "• echo:        Echo a message back",
      "• date:        Current date/time (ISO + locale)",
      "• uuid:        Generate random UUID v4",
      "• random:      Random integer (optional min/max, default 0-100)",
      "• calc:        Evaluate math expression (e.g., '2 + 3 * 4')",
      "• system_info: System diagnostics (OS, memory, CPU, Node version)",
      "",
      "**USAGE**:",
      "  toolbox({ tool: 'ls', args: { path: '.', all: true } })",
      "  toolbox({ tool: 'echo', args: { message: 'Hello' } })",
      "  toolbox({ tool: 'calc', args: { expression: '2+2' } })",
      "",
      "  Note: No need to specify mode - auto-detected from tool name.",
      "  Shell tools use cwd from session; actions are stateless.",
      "",
      "**EXTENSIBILITY**:",
      "  To add new tools, edit this file:",
      "  1. Shell tool: add schema + execute function, register in allTools",
      "  2. Action tool: add action object with execute + getParameters, register",
      "  3. Tool auto-available",
    ],
    parameters: {
      type: "object",
      properties: {
        tool: {
          type: "string",
          enum: Object.keys(allTools),
          description: "Tool name (auto-detects shell vs action mode)",
        },
        args: {
          type: "object",
          description: "Arguments for the selected tool (schema depends on tool)",
        },
      },
      required: ["tool", "args"],
    },

    async execute(_toolCallId: string, params: any, signal: AbortSignal | undefined, _onUpdate: any, ctx: any) {
      const { tool, args } = params;
      const toolEntry = allTools[tool];

      if (!toolEntry) {
        return {
          content: [{ type: "text", text: `Unknown tool: ${tool}. Available tools: ${Object.keys(allTools).join(", ")}` }],
          details: null,
          isError: true,
        } as const;
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
        return {
          content: [{ type: "text", text: `${tool} error: ${error.message}` }],
          details: null,
          isError: true,
        } as const;
      }
    },
  };
}

// ============================================================================
// Extension Registration
// ============================================================================

export function registerToolboxTool(api: import("@earendil-works/pi-coding-agent").ExtensionAPI): void {
  api.registerTool(createToolboxTool());
}

// ============================================================================
// Utilities (optional)
// ============================================================================

/**
 * Get list of all available tools
 */
export function getAvailableTools(): string[] {
  return Object.keys(allTools);
}

/**
 * Get tool info (type, schema)
 */
export function getToolInfo(name: string): { type: "shell" | "action"; schema: any } | null {
  const entry = allTools[name];
  if (!entry) return null;
  return { type: entry.type, schema: entry.schema };
}
