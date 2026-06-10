#!/usr/bin/env node
export function registerCustomMessageHandler(api) {
    // Listen for custom_message events
    api.on("message_end", async (event, ctx) => {
        const msg = event.message;
        if (msg.role === "custom" && msg.customType === "session_manager_event") {
            handleSessionManagerEvent(msg, ctx);
        }
    });
}
function handleSessionManagerEvent(msg, ctx) {
    const data = msg.details || {};
    const eventType = data.eventType;
    const timestamp = new Date().toISOString();
    console.log(`[SessionManager Event] ${eventType} at ${timestamp}`, data);
    if (ctx.hasUI && eventType) {
        const statusMap = {
            session_created: "New session",
            session_switched: "Switched",
            session_forked: "Forked",
            session_imported: "Imported",
        };
        const status = statusMap[eventType];
        if (status) {
            ctx.ui.setStatus("session_event", status);
        }
    }
}
export function emitSessionLifecycleMessage(ctx, eventType, data = {}) {
    try {
        // @ts-ignore - sendMessage exists on context but not in all typings
        ctx.sendMessage?.({
            customType: "session_manager_event",
            content: `${eventType}: ${JSON.stringify(data)}`,
            display: false,
            details: { eventType, ...data, timestamp: new Date().toISOString() },
        });
    }
    catch (e) {
        console.error("[AdvancedSession] Failed to emit custom message:", e);
    }
}
//# sourceMappingURL=custom-messages.js.map