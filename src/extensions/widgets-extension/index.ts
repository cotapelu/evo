#!/usr/bin/env node
/**
 * Widgets Extension – Interactive UI Demonstration
 *
 * Shows advanced UI capabilities:
 * - setWidget: custom live-updating component
 * - select: interactive selection
 * - editor: multi-line editor
 * - notify: notifications
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

type TurnStats = {
  count: number;
  lastDuration: number; // ms
};

const stats: TurnStats = { count: 0, lastDuration: 0 };

/**
 * Widget factory: returns a TUI component
 */
function makeTurnStatsWidget() {
  return (tui: any, theme: any) => {
    const text = `Turns: ${stats.count} | Last: ${stats.lastDuration}ms`;
    return new Text(text, 0, 0);
  };
}

/**
 * Register the extension
 */
export function registerWidgetsExtension(api: ExtensionAPI): void {
  // Listen to turn_end to update stats and refresh widget
  api.on('turn_end', (_event, ctx: ExtensionContext) => {
    stats.lastDuration = Math.floor(Math.random() * 500); // demo random
    stats.count++;
    ctx.ui.setWidget('turn-stats', makeTurnStatsWidget());
  });

  // Register a demo command that uses overlay components
  api.registerCommand('overlay-demo', {
    description: 'Demo overlay with select, editor, and notifications',
    handler: async (args: string, ctx: ExtensionContext) => {
      // Show a select list (overlay)
      const choice = await ctx.ui.select('Choose an option:', ['A - First', 'B - Second', 'C - Cancel']);
      if (!choice) {
        ctx.ui.notify('Selection cancelled', 'warning');
        return;
      }
      // Show an editor for multi-line input
      const userInput = await ctx.ui.editor('Enter your notes:', '');
      ctx.ui.notify(`You selected: ${choice}\nEditor content: ${userInput || '(empty)'}`, 'info');
    },
  });

  // Initialize widget on session start (optional)
  api.on('session_start', () => {
    stats.count = 0;
    stats.lastDuration = 0;
    // Could set initial widget, but will be set after first turn
  });
}

export default registerWidgetsExtension;
