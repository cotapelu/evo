#!/usr/bin/env node
/**
 * Metrics Dashboard Widget
 *
 * Shows real-time resource usage and session stats.
 * Toggle with /metrics command.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
/**
 * Toggle metrics widget visibility.
 */
export declare function toggleMetricsWidget(ctx: any): boolean;
/**
 * Get enabled state for current session.
 */
export declare function getMetricsWidgetEnabled(ctx: any): boolean;
export declare function registerMetricsWidget(api: ExtensionAPI): void;
//# sourceMappingURL=metrics-widget.d.ts.map