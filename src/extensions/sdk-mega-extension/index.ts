#!/usr/bin/env node
/**
 * SDK Mega Extension – Very Simple
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadSkillsFromDir, formatSkillsForPrompt, getAgentDir, type Skill } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";

// ============================================================================
// COMMAND: Skills Loader
// ============================================================================
function registerSkillCommands(api: ExtensionAPI): void {
	api.registerCommand("skills.load", {
		description: "Load skills from ./skills",
		handler: async (args: string, ctx: any) => {
			const dir = args.trim() || join(ctx.cwd, "skills");
			try {
				// @ts-ignore – typing complex
				const result = await loadSkillsFromDir(dir);
				const skills: Skill[] = result.skills;
				ctx.ui.notify?.(`Loaded ${skills.length} skills`, "info");
				const formatted = formatSkillsForPrompt(skills);
				api.appendEntry("skill_block", { skills: formatted });
			} catch (e: any) {
				ctx.ui.notify?.(`Load failed: ${e.message}`, "error");
			}
		},
	});
}

// ============================================================================
// COMMAND: Agent Dir & Paths
// ============================================================================
function registerAgentDirCommand(api: ExtensionAPI): void {
	api.registerCommand("agent.dir", {
		description: "Show agent directory",
		handler: async (_args: string, ctx: any) => {
			ctx.ui.notify?.(`Agent dir: ${getAgentDir()}`, "info");
		},
	});

	api.registerCommand("agent.paths", {
		description: "Show important paths",
		handler: async (_args: string, ctx: any) => {
			const dir = getAgentDir();
			ctx.ui.notify?.(`Agent: ${dir}\nCWD: ${ctx.cwd}`, "info");
		},
	});
}

// ============================================================================
// Main
// ============================================================================
export function registerSdkMegaExtension(api: ExtensionAPI): void {
	registerSkillCommands(api);
	registerAgentDirCommand(api);

	api.sendMessage?.({
		customType: "sdk-mega",
		content: "SDK Mega loaded",
		display: false,
	});
}

export default registerSdkMegaExtension;
