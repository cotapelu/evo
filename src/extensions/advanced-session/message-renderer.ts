#!/usr/bin/env node

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

export function registerMessageRenderer(api: ExtensionAPI): void {
  // Use generic any for message type to avoid complex imports
  api.registerMessageRenderer("session_manager_event", (msg: any, options, theme) => {
    const data = msg.details as any;
    const eventType = data?.eventType;
    const timestamp = data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '';

    const lines: string[] = [`Session Event: ${eventType}`];
    if (timestamp) lines.push(`Time: ${timestamp}`);
    if (data.sessionId) lines.push(`Session: ${data.sessionId.substring(0, 12)}`);
    if (data.entryId) lines.push(`Entry: ${data.entryId}`);
    if (data.path) lines.push(`Path: ${data.path}`);

    return new Text(theme.fg("accent", lines.join("\n")), 0, 0);
  });
}
