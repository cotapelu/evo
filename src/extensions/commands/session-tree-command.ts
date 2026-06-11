#!/usr/bin/env node

/**
 * Session Tree Command
 *
 * Provides an interactive UI to navigate the session tree.
 */

import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { DynamicBorder, TreeSelectorComponent } from "@earendil-works/pi-coding-agent";
import { Container, Text, Spacer } from "@earendil-works/pi-tui";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import type { SessionTreeNode } from "@earendil-works/pi-coding-agent/dist/core/session-manager";
import { addSectionHeader } from "../utils/widget-helpers.js";

// Helper functions for rendering entry details (extracted to reduce function size)
function renderMessageDetails(e: any): string[] {
  const msgEntry = e;
  const msg = msgEntry.message;
  const lines: string[] = [];
  lines.push('\n--- Message ---');
  lines.push(`Role: ${msg.role}`);
  if ('content' in msg && msg.content) {
    const content = msg.content as any[];
    if (Array.isArray(content)) {
      for (const c of content) {
        if (c.type === 'text') {
          lines.push(`Text: ${c.text?.substring(0, 200) || ''}${c.text && c.text.length > 200 ? '...' : ''}`);
        } else if (c.type === 'image') {
          lines.push(`[Image: ${c.source?.mediaType || 'unknown'}]`);
        }
      }
    }
  }
  return lines;
}

function renderBranchSummaryDetails(e: any): string[] {
  const bs = e;
  const lines: string[] = [];
  lines.push('\n--- Branch Summary ---');
  lines.push(`From: ${bs.fromId}`);
  if (bs.summary) {
    lines.push(`Summary: ${bs.summary.substring(0, 200)}${bs.summary.length > 200 ? '...' : ''}`);
  }
  return lines;
}

function renderCompactionDetails(e: any): string[] {
  const comp = e;
  const lines: string[] = [];
  lines.push('\n--- Compaction Summary ---');
  lines.push(`Tokens before: ${comp.tokensBefore ?? 'N/A'}`);
  lines.push(`First kept: ${comp.firstKeptEntryId ?? 'none'}`);
  if (comp.summary) {
    const summaryPreview = comp.summary.length > 200 ? comp.summary.substring(0, 200) + '...' : comp.summary;
    lines.push(`Summary: ${summaryPreview}`);
  }
  return lines;
}

function renderCustomMessageDetails(e: any): string[] {
  const cm = e;
  const lines: string[] = [];
  lines.push('\n--- Custom Message ---');
  lines.push(`Custom type: ${cm.customType}`);
  lines.push(`Display: ${cm.display}`);
  if (typeof cm.content === 'string') {
    lines.push(`Content: ${cm.content.substring(0, 200)}${cm.content.length > 200 ? '...' : ''}`);
  }
  return lines;
}

function renderLabelDetails(e: any): string[] {
  const label = e;
  const lines: string[] = [];
  lines.push('\n--- Label ---');
  lines.push(`Target: ${label.targetId}`);
  lines.push(`Label: ${label.label ?? "<empty>"}`);
  return lines;
}

function renderDetailsForType(entry: any): string[] {
  const type = entry.type;
  switch (type) {
    case 'message': return renderMessageDetails(entry);
    case 'branch_summary': return renderBranchSummaryDetails(entry);
    case 'compaction': return renderCompactionDetails(entry);
    case 'custom_message': return renderCustomMessageDetails(entry);
    case 'label': return renderLabelDetails(entry);
    default: return [`Unknown entry type: ${type}`];
  }
}


export class EntryDetailView {
  private entry: SessionEntry;
  private cachedLines: string[] = [];
  private cachedWidth: number | undefined;

  constructor(entry: SessionEntry) {
    this.entry = entry;
  }

  setEntry(entry: SessionEntry): void {
    this.entry = entry;
    this.cachedWidth = undefined;
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const e = this.entry;
    const common: string[] = [
      `Entry ID: ${e.id}`,
      `Parent ID: ${e.parentId ?? "<root>"}`,
      `Type: ${e.type}`,
      `Timestamp: ${new Date(e.timestamp).toLocaleString()}`,
    ];
    const specific = renderDetailsForType(e);
    const lines = [...common, ...specific];

    // Wrap lines to width
    const wrapped: string[] = [];
    for (const line of lines) {
      if (line.length <= width) {
        wrapped.push(line);
      } else {
        for (let i = 0; i < line.length; i += width) {
          wrapped.push(line.substring(i, i + width));
        }
      }
    }

    this.cachedLines = wrapped;
    this.cachedWidth = width;
    return wrapped;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = [];
  }
}

// Command 'tree' removed - using built-in '/tree' from pi-coding-agent
// Kept for reference if needed as a separate command name later

