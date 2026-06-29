import { describe, it, expect } from "vitest";
import { EntryDetailView } from "@extensions/commands/session-tree-command";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";

function fakeTheme() {
  return { fg: (color: string, text: string) => text };
}

describe("EntryDetailView", () => {
  it("renders message entry with role and text content", () => {
    const view = new EntryDetailView({} as unknown as SessionEntry);
    const entry = {
      type: "message",
      id: "m1",
      parentId: null,
      timestamp: Date.now(),
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Test message content" }],
      },
    } as unknown as SessionEntry;
    view.setEntry(entry);
    const lines = view.render(80);
    const text = lines.join("\n");
    expect(text).toContain("Entry ID: m1");
    expect(text).toContain("Type: message");
    expect(text).toContain("Role: assistant");
    expect(text).toContain("Text: Test message content");
  });

  it("renders branch_summary entry", () => {
    const view = new EntryDetailView({} as unknown as SessionEntry);
    const entry = {
      type: "branch_summary",
      id: "b1",
      parentId: "root",
      timestamp: Date.now(),
      fromId: "abc123",
      summary: "This is a branch summary",
    } as unknown as SessionEntry;
    view.setEntry(entry);
    const lines = view.render(80);
    const text = lines.join("\n");
    expect(text).toContain("Entry ID: b1");
    expect(text).toContain("Type: branch_summary");
    expect(text).toContain("From: abc123");
    expect(text).toContain("Summary: This is a branch summary");
  });

  it("renders compaction entry", () => {
    const view = new EntryDetailView({} as unknown as SessionEntry);
    const entry = {
      type: "compaction",
      id: "c1",
      parentId: null,
      timestamp: Date.now(),
      tokensBefore: 1234,
      firstKeptEntryId: "e1",
      summary: "Compaction summary text",
    } as unknown as SessionEntry;
    view.setEntry(entry);
    const text = view.render(80).join("\n");
    expect(text).toContain("Type: compaction");
    expect(text).toContain("Tokens before: 1234");
    expect(text).toContain("First kept: e1");
    expect(text).toContain("Summary: Compaction summary text");
  });

  it("renders custom_message entry", () => {
    const view = new EntryDetailView({} as unknown as SessionEntry);
    const entry = {
      type: "custom_message",
      id: "cm1",
      parentId: null,
      timestamp: Date.now(),
      customType: "info",
      display: "Info message",
      content: "Custom content string",
    } as unknown as SessionEntry;
    view.setEntry(entry);
    const text = view.render(80).join("\n");
    expect(text).toContain("Type: custom_message");
    expect(text).toContain("Custom type: info");
    expect(text).toContain("Display: Info message");
    expect(text).toContain("Content: Custom content string");
  });

  it("renders label entry", () => {
    const view = new EntryDetailView({} as unknown as SessionEntry);
    const entry = {
      type: "label",
      id: "l1",
      parentId: "p1",
      timestamp: Date.now(),
      targetId: "target1",
      label: "important",
    } as unknown as SessionEntry;
    view.setEntry(entry);
    const text = view.render(80).join("\n");
    expect(text).toContain("Type: label");
    expect(text).toContain("Target: target1");
    expect(text).toContain("Label: important");
  });

  it("renders unknown entry type", () => {
    const view = new EntryDetailView({} as unknown as SessionEntry);
    const entry = {
// @ts-ignore
      type: "unknown_type",
      id: "x1",
      parentId: null,
      timestamp: Date.now(),
    } as unknown as SessionEntry;
    view.setEntry(entry);
    const text = view.render(80).join("\n");
    expect(text).toContain("Unknown entry type: unknown_type");
  });

  it("caches render result when width unchanged", () => {
    const view = new EntryDetailView({} as unknown as SessionEntry);
    const entry = {
      type: "message",
      id: "m1",
      parentId: null,
      timestamp: Date.now(),
      message: {
        role: "user",
        content: [{ type: "text", text: "Hello" }],
      },
    } as unknown as SessionEntry;
    view.setEntry(entry);
    const lines1 = view.render(80);
    const lines2 = view.render(80);
    expect(lines1).toBe(lines2);
  });

  it("invalidates cache on setEntry", () => {
    const view = new EntryDetailView({} as unknown as SessionEntry);
    const entry1 = {
      type: "message",
      id: "m1",
      parentId: null,
      timestamp: Date.now(),
      message: {
        role: "user",
        content: [{ type: "text", text: "First" }],
      },
    } as unknown as SessionEntry;
    view.setEntry(entry1);
    const lines1 = view.render(80);
    const entry2 = {
      type: "message",
      id: "m2",
      parentId: null,
      timestamp: Date.now(),
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Second" }],
      },
    } as unknown as SessionEntry;
    view.setEntry(entry2);
    const lines2 = view.render(80);
    expect(lines1).not.toBe(lines2);
    expect(lines2.some(l => l.includes("m2"))).toBe(true);
  });

  it("renders message entry with image content", () => {
    const view = new EntryDetailView({} as unknown as SessionEntry);
    const entry = {
      type: "message",
      id: "m1",
      parentId: null,
      timestamp: Date.now(),
      message: {
        role: "user",
        content: [{ type: "image", source: { mediaType: "image/png" } }],
      },
    } as unknown as SessionEntry;
    view.setEntry(entry);
    const lines = view.render(80);
    const text = lines.join("\n");
    expect(text).toContain("[Image: image/png]");
  });

  it("wraps long lines to fit width", () => {
    const view = new EntryDetailView({} as unknown as SessionEntry);
    const longText = "A".repeat(200);
    const entry = {
      type: "message",
      id: "m1",
      parentId: null,
      timestamp: Date.now(),
      message: {
        role: "assistant",
        content: [{ type: "text", text: longText }],
      },
    } as unknown as SessionEntry;
    view.setEntry(entry);
    const lines = view.render(50); // small width forces wrap
    // Long text will be split into multiple lines
    expect(lines.length).toBeGreaterThan(1);
    // Ensure the long text appears across lines
    const combined = lines.join("");
    expect(combined).toContain(longText);
  });

  it("invalidate clears cached render data", () => {
    const view = new EntryDetailView({} as unknown as SessionEntry);
    const entry = {
      type: "message",
      id: "m1",
      parentId: null,
      timestamp: Date.now(),
      message: {
        role: "user",
        content: [{ type: "text", text: "Test" }],
      },
    } as unknown as SessionEntry;
    view.setEntry(entry);
    view.render(80); // populate cache
    // Access internal cache via any to verify state
    const v: any = view;
    expect(v.cachedLines.length).toBeGreaterThan(0);
    expect(v.cachedWidth).toBe(80);
    // Invalidate
    view.invalidate();
    expect(v.cachedLines).toEqual([]);
    expect(v.cachedWidth).toBeUndefined();
  });
});
