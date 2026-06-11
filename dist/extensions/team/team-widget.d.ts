#!/usr/bin/env node
/**
 * Team Status Widget
 *
 * Shows live team overview in the UI widget area.
 * Displays: active teams, task progress, agent statuses.
 * Supports toggle via /team command.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
/**
 * Toggle team widget visibility.
 * @returns new enabled state (true = visible)
 */
export declare function toggleTeamWidget(ctx: any): boolean;
/**
 * Get current team widget enabled state for a given session context.
 */
export declare function getTeamWidgetEnabled(ctx: any): boolean;
export declare function registerTeamWidget(api: ExtensionAPI): void;
//# sourceMappingURL=team-widget.d.ts.map