#!/usr/bin/env node
export function registerSessionCommands(api) {
    // /sessions
    api.registerCommand("sessions", {
        description: "List all sessions",
        handler: async (_arg, ctx) => {
            // Directly call session manager - not via tool
            try {
                const SessionManager = (await import("@earendil-works/pi-coding-agent")).SessionManager;
                const sessions = await SessionManager.list(ctx.cwd);
                const text = `Sessions (${sessions.length}):\n` + sessions.map((s) => `- ${s.id.substring(0, 8)}: ${s.name || '(unnamed)'} (${s.messageCount} msgs)`).join("\n");
                if (ctx.hasUI) {
                    ctx.ui.notify(`Found ${sessions.length} sessions`, "info");
                }
                // If in interactive editor, maybe set to input? For now just status
                ctx.ui.setStatus("sessions", `Sessions: ${sessions.length}`);
            }
            catch (e) {
                ctx.ui.notify(`Error: ${e.message}`, "error");
            }
        },
    });
}
//# sourceMappingURL=commands.js.map