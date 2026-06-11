#!/usr/bin/env node
/**
 * Metrics Dashboard Widget
 *
 * Shows real-time resource usage and session stats.
 * Toggle with /metrics command.
 */
const METRICS_WIDGET_STATE = Symbol('metricsWidgetState');
function getState(ctx) {
    return ctx[METRICS_WIDGET_STATE];
}
function ensureState(ctx) {
    let state = getState(ctx);
    if (!state) {
        state = { enabled: true, ctx: ctx, intervalId: null };
        ctx[METRICS_WIDGET_STATE] = state;
    }
    return state;
}
function buildHeaderLines(theme) {
    return [
        theme.fg("accent", "📊 Metrics").bold(),
        ""
    ];
}
function buildMetricsLines(ctx, theme) {
    const lines = [];
    // Context usage (tokens)
    const usage = ctx.getContextUsage();
    if (usage && usage.tokens !== null) {
        lines.push(`${theme.fg("muted", "Tokens:")} ${usage.tokens} / ${usage.contextWindow} (${usage.percent?.toFixed(1) ?? '?'}%)`);
    }
    else {
        lines.push(theme.fg("muted", "No token usage data"));
    }
    // Model info
    if (ctx.model) {
        lines.push(`${theme.fg("muted", "Model:")} ${ctx.model.id}`);
    }
    // Abort status
    if (ctx.signal) {
        lines.push(theme.fg("warning", "Operation abortable"));
    }
    // Agent idle status
    const idle = ctx.isIdle();
    lines.push(`${theme.fg("muted", "Status:")} ${idle ? theme.fg("green", "idle") : theme.fg("yellow", "working")}`);
    return lines;
}
async function refreshWidget(ctx) {
    const ui = ctx.ui;
    const lines = [];
    lines.push(...buildHeaderLines(ui.theme));
    lines.push(...buildMetricsLines(ctx, ui.theme));
    ui.setWidget("metrics", lines);
}
function startWidget(ctx) {
    const state = ensureState(ctx);
    if (state.intervalId)
        return;
    state.ctx = ctx;
    refreshWidget(ctx).catch(() => { });
    state.intervalId = setInterval(() => {
        if (state.enabled && state.ctx) {
            refreshWidget(state.ctx).catch(() => { });
        }
    }, 5000);
}
function stopWidget(state) {
    if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = null;
    }
    if (state.ctx) {
        try {
            state.ctx.ui.setWidget("metrics", undefined);
        }
        catch { }
        state.ctx = null;
    }
}
/**
 * Toggle metrics widget visibility.
 */
export function toggleMetricsWidget(ctx) {
    const state = ensureState(ctx);
    state.enabled = !state.enabled;
    if (state.enabled) {
        startWidget(ctx);
    }
    else {
        stopWidget(state);
    }
    return state.enabled;
}
/**
 * Get enabled state for current session.
 */
export function getMetricsWidgetEnabled(ctx) {
    const state = getState(ctx);
    return state?.enabled ?? true;
}
export function registerMetricsWidget(api) {
    api.on("session_start", async (_event, ctx) => {
        // Create per-session state, default enabled
        const state = { enabled: true, ctx: ctx, intervalId: null };
        ctx[METRICS_WIDGET_STATE] = state;
        startWidget(ctx);
        api.on("session_shutdown", () => {
            stopWidget(state);
            delete ctx[METRICS_WIDGET_STATE];
        });
    });
}
//# sourceMappingURL=metrics-widget.js.map