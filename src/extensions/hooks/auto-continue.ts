#!/usr/bin/env node
/**
 * Auto-Continue Extension
 *
 * When the agent is idle (after finishing a response) for too long,
 * automatically send a message to remind the LLM to continue.
 * Use /gnpi to toggle on/off or set timeout: /gnpi on 30 (30 seconds) or /gnpi off.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import * as path from "node:path";
import { existsSync, readFileSync } from "node:fs";

// Debug flag - set via environment variable AUTO_CONTINUE_DEBUG=1
const DEBUG = process.env.AUTO_CONTINUE_DEBUG === "1";

const DEFAULT_IDLE_TIMEOUT_MS = 30_000; // 30 seconds
const DEFAULT_IDLE_MESSAGE = "Continue next task in docs/TODO.md, remember update done and git commit.";
const REMINDER_FILE = "AUTO-CONTINUE.md";

// Find project root by looking for package.json, .git, or pi.config.json
function findProjectRoot(startPath: string): string {
  let current = startPath;
  const root = path.parse(current).root;

  while (current && current !== root) {
    if (
      existsSync(path.join(current, "package.json")) ||
      existsSync(path.join(current, ".git")) ||
      existsSync(path.join(current, "pi.config.json"))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break; // safety
    current = parent;
  }
  // Fallback to startPath
  return startPath;
}

// Read reminder message from file in project root
function loadReminderMessage(): string {
  try {
    const cwd = process.cwd();
    if (!cwd) {
      throw new Error("Current working directory is not set");
    }
    const projectRoot = findProjectRoot(cwd);
    const filePath = path.join(projectRoot, REMINDER_FILE);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, "utf-8");
      // Take entire content (trim only leading/trailing whitespace)
      const trimmed = content.trim();
      if (trimmed) {
        if (DEBUG) console.log("[AutoContinue] Loaded reminder from:", filePath);
        return trimmed;
      }
    }
  } catch (error) {
    if (DEBUG) console.error("[AutoContinue] Failed to load reminder file:", error);
  }
  if (DEBUG) console.log("[AutoContinue] Using default message");
  return DEFAULT_IDLE_MESSAGE;
}

const IDLE_MESSAGE = loadReminderMessage();

export default function (pi: ExtensionAPI) {
  let enabled = false;
  let idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  // Cleanup timer on shutdown
  pi.on("session_shutdown", () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  });

  // Start idle timer
  const startIdleTimer = () => {
    if (!enabled) return;
    if (idleTimer) return;
    idleTimer = setTimeout(() => {
      if (enabled) {
        if (DEBUG) console.log("[AutoContinue] Timer fired, sending reminder");
        pi.sendMessage(
          { customType: "auto-continue", content: IDLE_MESSAGE, display: false },
          { triggerTurn: true, deliverAs: "followUp" }
        );
        if (DEBUG) console.log("[AutoContinue] Sent idle reminder");
      }
      idleTimer = null;
    }, idleTimeoutMs);
  };

  // Register /gnpi command
  pi.registerCommand("gnpi", {
    description: "Toggle auto-continue: /gnpi [on|off|seconds]. Enable/disable or set timeout (seconds)",
    handler: async (args: string, ctx: ExtensionContext) => {
      const trimmedArgs = args.trim();
      const parts = trimmedArgs.split(/\s+/).filter(p => p.length > 0);
      const command = parts[0]?.toLowerCase();

      if (command === "off" || command === "0") {
        enabled = false;
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
        if (ctx.hasUI) {
          ctx.ui.notify("Auto-continue disabled", "info");
        }
        if (DEBUG) console.log("[AutoContinue] Disabled");
        return;
      }

      if (command === "on" || command === "1") {
        enabled = true;
        if (ctx.hasUI) {
          ctx.ui.notify(`Auto-continue enabled - will send reminder after ${idleTimeoutMs / 1000} seconds of idle`, "info");
        }
        if (ctx.isIdle()) {
          startIdleTimer();
          if (DEBUG) console.log("[AutoContinue] Started timer immediately (was idle)");
        }
        if (DEBUG) console.log("[AutoContinue] Enabled");
        return;
      }

      // If args is a number, set timeout
      const timeoutSec = parseInt(parts[0], 10);
      if (!isNaN(timeoutSec) && timeoutSec > 0) {
        idleTimeoutMs = timeoutSec * 1000;
        if (ctx.hasUI) {
          ctx.ui.notify(`Auto-continue timeout set to ${timeoutSec} seconds`, "info");
        }
        if (DEBUG) console.log(`[AutoContinue] Timeout set to ${idleTimeoutMs}ms`);
        return;
      }

      // If no args or just toggle, toggle state
      enabled = !enabled;
      if (enabled) {
        if (ctx.hasUI) {
          ctx.ui.notify(`Auto-continue enabled - timeout=${idleTimeoutMs / 1000}s`, "info");
        }
        if (ctx.isIdle()) {
          startIdleTimer();
        }
        if (DEBUG) console.log("[AutoContinue] Enabled via toggle");
      } else {
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
        if (ctx.hasUI) {
          ctx.ui.notify("Auto-continue disabled", "info");
        }
        if (DEBUG) console.log("[AutoContinue] Disabled via toggle");
      }
    },
  });

  // Listen to agent_end using pi.on()
  pi.on("agent_end", () => {
    if (!enabled) return;
    if (DEBUG) console.log("[AutoContinue] agent_end fired, starting timer");
    startIdleTimer();
  });
}
