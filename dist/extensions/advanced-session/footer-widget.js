#!/usr/bin/env node
/**
 * Session Footer Widget
 *
 * Custom footer showing live session statistics.
 * Demonstrates: ctx.ui.setFooter(), FooterDataProvider, event subscriptions.
 */
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { getCacheForContext } from "./session-stats-cache.js";
let enabled = false;
export function registerSessionFooter(api) {
    // Command to toggle footer (optional)
    api.registerCommand("session_footer", {
        description: "Toggle custom session footer",
        handler: async (_arg, ctx) => {
            enabled = !enabled;
            installFooter(ctx);
            ctx.ui.notify(`Session footer ${enabled ? "enabled" : "disabled"}`, "info");
        },
    });
    // Auto-enable on session start if user wants (optional)
    api.on("session_start", async (event, ctx) => {
        // Auto-enable for convenience
        if (!enabled) {
            enabled = true;
            installFooter(ctx);
        }
    });
}
function installFooter(ctx) {
    if (enabled) {
        ctx.ui.setFooter((tui, theme, footerData) => {
            // Subscribe to branch changes to trigger re-render
            const unsub = footerData.onBranchChange(() => tui.requestRender());
            return {
                dispose: unsub,
                invalidate() { },
                render(width) {
                    // Get cache for current context
                    const cache = getCacheForContext(ctx);
                    let stats = "Session stats unavailable";
                    if (cache) {
                        const fmt = (n) => (n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`);
                        stats = `S:${cache.sessionId.substring(0, 6)} | M:${fmt(cache.messageCount)} | T:${fmt(cache.turnCount)} | C:${cache.compactionCount} | B:${cache.branchCount}`;
                    }
                    // Left: stats
                    const left = theme.fg("dim", stats);
                    // Right: model + cwd short
                    const model = ctx.model?.id?.split('/').pop() || "no-model";
                    const cwdParts = ctx.cwd.split(/[\\/]/);
                    const cwd = cwdParts[cwdParts.length - 1] || ctx.cwd;
                    const right = theme.fg("dim", `${model} ${cwd}`);
                    // Truncate to fit width
                    const totalWidth = visibleWidth(left) + visibleWidth(right);
                    const pad = totalWidth >= width ? 0 : width - totalWidth;
                    const content = truncateToWidth(left + " ".repeat(Math.max(1, pad)) + right, width);
                    return [content];
                },
            };
        });
    }
    else {
        ctx.ui.setFooter(undefined);
    }
}
//# sourceMappingURL=footer-widget.js.map