#!/usr/bin/env node

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// Custom message type (using minimal structure)
interface SessionManagerEventMessage {
  customType: "session_manager_event";
  content: string;
  display: boolean;
  details: {
    eventType: string;
    [key: string]: any;
  };
}

export function registerCustomMessageHandler(api: ExtensionAPI): void {
  // Listen for custom_message events
  api.on("message_end", async (event, ctx) => {
    const msg = event.message as any;
    if (msg.role === "custom" && msg.customType === "session_manager_event") {
      handleSessionManagerEvent(msg, ctx);
    }
  });
}

function handleSessionManagerEvent(msg: any, ctx: ExtensionContext): void {
  const data = msg.details || {};
  const eventType = data.eventType;
  const timestamp = new Date().toISOString();

  console.log(`[SessionManager Event] ${eventType} at ${timestamp}`, data);

  if (ctx.hasUI && eventType) {
    const statusMap: Record<string, string> = {
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

export function emitSessionLifecycleMessage(
  ctx: ExtensionContext,
  eventType: string,
  data: Record<string, any> = {}
): void {
  try {
    // @ts-ignore - sendMessage exists on context but not in all typings
    ctx.sendMessage?.({
      customType: "session_manager_event",
      content: `${eventType}: ${JSON.stringify(data)}`,
      display: false,
      details: { eventType, ...data, timestamp: new Date().toISOString() },
    } as any);
  } catch (e) {
    console.error("[AdvancedSession] Failed to emit custom message:", e);
  }
}
