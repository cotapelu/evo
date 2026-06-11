#!/usr/bin/env node
/**
 * Metrics Widget Toggle Command
 *
 * Toggle the metrics dashboard widget.
 * Usage: /metrics (toggle on/off)
 */
import { toggleMetricsWidget, getMetricsWidgetEnabled } from "../metrics/metrics-widget.js";
export function registerMetricsCommand(api) {
    api.registerCommand("metrics", {
        description: "Toggle metrics dashboard widget",
        handler: async (_args, ctx) => {
            const before = getMetricsWidgetEnabled(ctx);
            const after = toggleMetricsWidget(ctx);
            const status = after ? "shown" : "hidden";
            ctx.ui.notify(`Metrics widget ${status}`, "info");
        },
    });
}
//# sourceMappingURL=metrics-command.js.map