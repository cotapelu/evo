#!/usr/bin/env node
// ============================================================================
// 1. IMPORTS
// ============================================================================

import { createLogger } from "../../utils/logger.js";
import { metrics, METRIC_NAMES } from "../../utils/metrics.js";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import * as path from "node:path";
import { existsSync, readFileSync } from "node:fs";

// ============================================================================
// 2. PUBLIC API (Constants & Utilities)
// ============================================================================

/**
 * Default idle timeout in milliseconds (30 seconds).
 */
export const DEFAULT_IDLE_TIMEOUT_MS = 30_000;

/**
 * Default reminder message displayed when auto-continue triggers.
 */
export const DEFAULT_IDLE_MESSAGE = "Continue next task in docs/TODO.md, remember update done and git commit.";

/**
 * Filename for custom reminder message (placed in project root).
 */
export const REMINDER_FILE = "AUTO-CONTINUE.md";

// Create logger for this hook
const logger = createLogger('AutoContinue');

/**
 * Finds the project root directory by searching for package.json, .git, or pi.config.json.
 * @param startPath - Path to start searching from
 * @returns Absolute path to project root
 */
export function findProjectRoot(startPath: string): string {
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
		if (parent === current) break;
		current = parent;
	}
	return startPath;
}

/**
 * Loads the reminder message from AUTO-CONTINUE.md in project root, or uses default.
 * @returns Reminder message string
 */
export function loadReminderMessage(): string {
	try {
		const projectRoot = findProjectRoot(process.cwd());
		const filePath = path.join(projectRoot, REMINDER_FILE);
		if (existsSync(filePath)) {
			const content = readFileSync(filePath, "utf-8");
			const trimmed = content.trim();
			if (trimmed) {
				logger.log(`[AutoContinue] Loaded reminder from ${filePath}`);
				return trimmed;
			}
		}
	} catch (error) {
		logger.error("[AutoContinue] Failed to load reminder file", { error });
	}
	logger.log("[AutoContinue] Using default message");
	return DEFAULT_IDLE_MESSAGE;
}

const IDLE_MESSAGE = loadReminderMessage();

// ============================================================================
// 3. EXTENSION FACTORY (Main)
// ============================================================================

/**
 * Auto-continue extension factory.
 * Provides /gnpi command to toggle auto-continue behavior.
 */
export default function (pi: ExtensionAPI) {
	logger.log('Extension loaded - registering gnpi command');
	let enabled = false;
	let idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS;
	let idleTimer: ReturnType<typeof setTimeout> | null = null;

	pi.on("session_shutdown", () => {
		if (idleTimer) {
			clearTimeout(idleTimer);
			idleTimer = null;
		}
	});

	const startIdleTimer = () => {
		if (!enabled) return;
		if (idleTimer) return;
		idleTimer = setTimeout(() => {
			if (enabled) {
				pi.sendMessage(
					{ customType: "auto-continue", content: IDLE_MESSAGE, display: false },
					{ triggerTurn: true, deliverAs: "followUp" }
				);
			}
			idleTimer = null;
		}, idleTimeoutMs);
	};

	pi.registerCommand("gnpi", {
		description: "Toggle auto-continue: /gnpi [on|off|seconds]",
		handler: async (args: string, ctx: ExtensionContext) => {
			const parts = args.trim().split(/\s+/);
			const command = parts[0].toLowerCase();

			// Sub-handlers to reduce cyclomatic complexity
			const doOff = () => {
				enabled = false;
				metrics.setGauge(METRIC_NAMES.ENABLED_AUTO_CONTINUE, 0);
				metrics.incrementCounter(METRIC_NAMES.AUTO_CONTINUE_DEACTIVATED);
				if (idleTimer) {
					clearTimeout(idleTimer);
					idleTimer = null;
				}
				if (ctx.hasUI) {
					ctx.ui.notify("Auto-continue đã TẮT", "info");
				}
			};

			const doOn = () => {
				enabled = true;
				metrics.setGauge(METRIC_NAMES.ENABLED_AUTO_CONTINUE, 1);
				metrics.incrementCounter(METRIC_NAMES.AUTO_CONTINUE_ACTIVATED);
				if (ctx.hasUI) {
					ctx.ui.notify(`Auto-continue đã BẬT - ${idleTimeoutMs / 1000}s timeout`, "info");
				}
				if (ctx.isIdle()) {
					startIdleTimer();
				}
			};

			const doTimeout = (seconds: number) => {
				idleTimeoutMs = seconds * 1000;
				if (ctx.hasUI) {
					ctx.ui.notify(`Auto-continue timeout set to ${seconds} giây`, "info");
				}
			};

			const doToggle = () => {
				enabled = !enabled;
				if (enabled) {
					metrics.setGauge(METRIC_NAMES.ENABLED_AUTO_CONTINUE, 1);
					metrics.incrementCounter(METRIC_NAMES.AUTO_CONTINUE_ACTIVATED);
					if (ctx.hasUI) {
						ctx.ui.notify(`Auto-continue đã BẬT - timeout=${idleTimeoutMs / 1000}s`, "info");
					}
					if (ctx.isIdle()) {
						startIdleTimer();
					}
				} else {
					metrics.setGauge(METRIC_NAMES.ENABLED_AUTO_CONTINUE, 0);
					metrics.incrementCounter(METRIC_NAMES.AUTO_CONTINUE_DEACTIVATED);
					if (idleTimer) {
						clearTimeout(idleTimer);
						idleTimer = null;
					}
					if (ctx.hasUI) {
						ctx.ui.notify("Auto-continue đã TẮT", "info");
					}
				}
			};

			switch (command) {
				case "off":
				case "0":
					doOff();
					break;
				case "on":
				case "1":
					doOn();
					break;
				default: {
					const timeoutSec = parseInt(parts[0], 10);
					if (!isNaN(timeoutSec) && timeoutSec > 0) {
						doTimeout(timeoutSec);
					} else {
						doToggle();
					}
				}
			}
		},
	});

	pi.on("agent_end", () => {
		if (!enabled) return;
		startIdleTimer();
	});

	pi.on("session_compact", () => {
		if (!enabled) return;
		startIdleTimer();
	});
	// Return empty object to satisfy extension discovery
	return {};
}
