#!/usr/bin/env node
/**
 * Notes Tool
 *
 * Session-scoped scratchpad for quick notes.
 * Actions: add, list, clear.
 * Notes are not persisted to branch history.
 */

import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import { Mutex } from '../utils/mutex.js';

interface Note {
  id: number;
  text: string;
  created: number;
}

// Per-session state (auto GC when context disposed)
const sessionStates = new WeakMap<any, { notes: Note[]; nextId: number; mutex: Mutex }>();

function getState(ctx: any) {
  let state = sessionStates.get(ctx);
  if (!state) {
    const mutex = new Mutex();
    state = { notes: [], nextId: 1, mutex };
    sessionStates.set(ctx, state);
  }
  return state;
}

function createNotesTool(): ToolDefinition<any, any> {
  return {
    name: 'notes',
    label: 'Notes',
    description: 'Session-scoped scratchpad. Actions: add (text), list, clear.',
    parameters: {},
    async execute(toolCallId, params, _signal, _onUpdate, ctx) {
      const state = getState(ctx);
      const release = await state.mutex.lock();
      try {
        let p: any;
        if (typeof params === 'string') {
          try {
            p = JSON.parse(params);
          } catch (e) {
            return {
              content: [{ type: 'text', text: `Invalid JSON: ${e}` }],
              details: { error: 'invalid json' },
              isError: true,
            };
          }
        } else {
          p = params;
        }

        const action = p?.action;
        if (!action) {
          return { content: [{ type: 'text', text: 'Missing action' }], details: { error: 'action required' }, isError: true };
        }

        switch (action) {
          case 'add': {
            const text = p.text;
            if (typeof text !== 'string' || !text.trim()) {
              return { content: [{ type: 'text', text: 'Missing text' }], details: { error: 'text required' }, isError: true };
            }
            const note: Note = { id: state.nextId++, text: text.trim(), created: Date.now() };
            state.notes.push(note);
            return {
              content: [{ type: 'text', text: `Added note #${note.id}` }],
              details: { action: 'add', notes: [...state.notes], nextId: state.nextId },
              isError: false,
            };
          }
          case 'list': {
            if (state.notes.length === 0) {
              return { content: [{ type: 'text', text: 'No notes' }], details: { action: 'list', notes: [] }, isError: false };
            }
            const lines = state.notes.map(n => `#${n.id}: ${n.text}`);
            return {
              content: [{ type: 'text', text: lines.join('\n') }],
              details: { action: 'list', notes: [...state.notes] },
              isError: false,
            };
          }
          case 'clear': {
            const count = state.notes.length;
            state.notes = [];
            state.nextId = 1;
            return {
              content: [{ type: 'text', text: `Cleared ${count} notes` }],
              details: { action: 'clear', notes: [] },
              isError: false,
            };
          }
          default: {
            return { content: [{ type: 'text', text: `Unknown action: ${action}` }], details: { error: 'invalid action' }, isError: true };
          }
        }
      } finally {
        release();
      }
    },

    renderCall(args: any, theme: any) {
      const th = theme;
      const action = args.action || '';
      const text = `${th.fg('toolTitle', th.bold('notes'))} ${th.fg('muted', action)}`;
      return new Text(text, 0, 0);
    },

    renderResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: any) {
      const th = theme;
      if (options.isPartial) return new Text(th.fg('warning', 'Processing...'), 0, 0);
      const details = result.details || {};
      if (details.error) return new Text(th.fg('error', `Error: ${details.error}`), 0, 0);
      switch (details.action) {
        case 'add': {
          const added = details.notes?.[details.notes.length - 1];
          return new Text(th.fg('success', `📝 #${added?.id}`), 0, 0);
        }
        case 'list': {
          const count = details.notes?.length || 0;
          return count === 0 ? new Text(th.fg('dim', 'No notes'), 0, 0) : new Text(th.fg('success', `📝 ${count} notes`), 0, 0);
        }
        case 'clear': {
          return new Text(th.fg('success', '🗑️ Cleared'), 0, 0);
        }
        default:
          return new Text('', 0, 0);
      }
    },
  };
}

export function registerNotesTool(api: ExtensionAPI): void {
  api.registerTool(createNotesTool());
}