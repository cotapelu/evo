#!/usr/bin/env node
/**
 * SDK Mega Extension – Very Simple
 */
import { loadSkillsFromDir, formatSkillsForPrompt, getAgentDir } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";
// ============================================================================
// COMMAND: Skills Loader
// ============================================================================
function registerSkillCommands(api) {
    api.registerCommand("skills.load", {
        description: "Load skills from ./skills",
        handler: async (args, ctx) => {
            const dir = args.trim() || join(ctx.cwd, "skills");
            try {
                // @ts-ignore – typing complex
                const result = await loadSkillsFromDir(dir);
                const skills = result.skills;
                ctx.ui.notify?.(`Loaded ${skills.length} skills`, "info");
                const formatted = formatSkillsForPrompt(skills);
                api.appendEntry("skill_block", { skills: formatted });
            }
            catch (e) {
                ctx.ui.notify?.(`Load failed: ${e.message}`, "error");
            }
        },
    });
}
// ============================================================================
// COMMAND: Agent Dir & Paths
// ============================================================================
function registerAgentDirCommand(api) {
    api.registerCommand("agent.dir", {
        description: "Show agent directory",
        handler: async (_args, ctx) => {
            ctx.ui.notify?.(`Agent dir: ${getAgentDir()}`, "info");
        },
    });
    api.registerCommand("agent.paths", {
        description: "Show important paths",
        handler: async (_args, ctx) => {
            const dir = getAgentDir();
            ctx.ui.notify?.(`Agent: ${dir}\nCWD: ${ctx.cwd}`, "info");
        },
    });
}
// ============================================================================
// Main
// ============================================================================
export function registerSdkMegaExtension(api) {
    registerSkillCommands(api);
    registerAgentDirCommand(api);
    api.sendMessage?.({
        customType: "sdk-mega",
        content: "SDK Mega loaded",
        display: false,
    });
}
export default registerSdkMegaExtension;
//# sourceMappingURL=index.js.map