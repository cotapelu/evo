#!/usr/bin/env node
import { Text } from "@earendil-works/pi-tui";
export function registerMessageRenderer(api) {
    // Use generic any for message type to avoid complex imports
    api.registerMessageRenderer("session_manager_event", (msg, options, theme) => {
        const data = msg.details;
        const eventType = data?.eventType;
        const timestamp = data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '';
        const lines = [`Session Event: ${eventType}`];
        if (timestamp)
            lines.push(`Time: ${timestamp}`);
        if (data.sessionId)
            lines.push(`Session: ${data.sessionId.substring(0, 12)}`);
        if (data.entryId)
            lines.push(`Entry: ${data.entryId}`);
        if (data.path)
            lines.push(`Path: ${data.path}`);
        return new Text(theme.fg("accent", lines.join("\n")), 0, 0);
    });
}
//# sourceMappingURL=message-renderer.js.map