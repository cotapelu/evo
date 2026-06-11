#!/usr/bin/env node
/**
 * Team Widget Toggle Command
 *
 * Toggle the team status widget visibility.
 * Usage: /team (toggle on/off)
 */
import { toggleTeamWidget, getTeamWidgetEnabled } from "../team/team-widget.js";
export function registerTeamCommand(api) {
    api.registerCommand("team", {
        description: "Toggle team status widget (show/hide)",
        handler: async (_args, ctx) => {
            const before = getTeamWidgetEnabled(ctx);
            const after = toggleTeamWidget(ctx);
            const status = after ? "shown" : "hidden";
            ctx.ui.notify(`Team widget ${status}`, "info");
        },
    });
}
//# sourceMappingURL=team-command.js.map