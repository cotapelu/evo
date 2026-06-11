#!/usr/bin/env node
/**
 * Global Command & Tool Autocomplete Provider
 *
 * Provides suggestions for slash commands and tool names across the app.
 * Demonstrates advanced context detection and fuzzy matching.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  type AutocompleteItem,
  type AutocompleteProvider,
  type AutocompleteSuggestions,
  fuzzyFilter,
} from "@earendil-works/pi-tui";

const MAX_SUGGESTIONS = 20;

// Known slash commands (from typical extensions)
const KNOWN_SLASH_COMMANDS = [
  'sessions',    // advanced-session
  'session',     // advanced-session alias
  'todos',       // todos tool
  'memory',      // memory tool
  'notes',       // notes tool
  'metrics',     // metrics tool
  'tool-metrics',// tool-metrics tool
  'coverage',    // coverage tool
  'coverage-history',
  'git',         // git tool
  'test',        // test-runner tool
  'code-health', // code-health tool
  'format',      // format tool
  'security-audit',
  'kicad-sch',
  'kicad-pcb',
  'watch',       // watch tool
  'about',       // about command
  'gnpi',        // auto-continue
  'team',        // team extension hint
  'help',
];

// Common tool names (subset for autocomplete)
const COMMON_TOOLS = [
  'todos',
  'memory',
  'branch',
  'session_info',
  'test_runner',
  'git',
  'kicad_sch',
  'kicad_pcb',
  'code_health',
  'format',
  'metrics',
  'security_audit',
  'extension_template_generator',
  'watch',
  'coverage',
  'coverage_history',
  'notes',
  'tool_metrics',
  'performance_advisor',
  'coverage_leaders',
  'session_manager',
  'session_summary',
  'team_run',
  'kilo',
];

/**
 * Detect context: slash command or tool call
 */
function detectGlobalContext(lines: string[], cursorLine: number, cursorCol: number): { type: 'slash' | 'tool'; token: string } | null {
  const currentLine = lines[cursorLine] ?? "";
  const textBeforeCursor = currentLine.slice(0, cursorCol);

  // Slash command: starts with '/' and then word characters
  const slashMatch = textBeforeCursor.match(/^\/([a-z0-9_-]*)$/i);
  if (slashMatch) {
    return { type: 'slash', token: slashMatch[1] };
  }

  // Tool call: word followed by '('
  const toolPattern = /([a-z][a-z0-9_-]*)\s*\($/i;
  const segment = textBeforeCursor.slice(-30);
  const toolMatch = segment.match(toolPattern);
  if (toolMatch) {
    return { type: 'tool', token: toolMatch[1] };
  }

  return null;
}

/**
 * Suggestions for slash commands
 */
function suggestSlashCommands(query: string): AutocompleteItem[] {
  if (!query.trim()) {
    return KNOWN_SLASH_COMMANDS.map(cmd => ({
      value: `/${cmd}`,
      label: `/${cmd}`,
      description: "slash command",
    }));
  }
  const matches = fuzzyFilter(KNOWN_SLASH_COMMANDS, query, (cmd) => cmd);
  return matches.map(cmd => ({
    value: `/${cmd}`,
    label: `/${cmd}`,
    description: "command",
  }));
}

/**
 * Suggestions for tool names
 */
function suggestToolNames(query: string): AutocompleteItem[] {
  if (!query.trim()) {
    return COMMON_TOOLS.map(tool => ({
      value: tool,
      label: tool,
      description: "tool",
    }));
  }
  const matches = fuzzyFilter(COMMON_TOOLS, query, (tool) => tool);
  return matches.map(tool => ({
    value: tool,
    label: tool,
    description: "tool",
  }));
}

/**
 * Create global autocomplete provider
 */
export function createGlobalAutocompleteProvider(
  current: AutocompleteProvider,
  cache: Map<string, AutocompleteItem[]>,
): AutocompleteProvider {
  return {
    async getSuggestions(lines: string[], cursorLine: number, cursorCol: number, options: any): Promise<AutocompleteSuggestions | null> {
      const context = detectGlobalContext(lines, cursorLine, cursorCol);
      if (context === null) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      const { type, token } = context;
      const cacheKey = `${type}:${token}`;

      if (options.signal.aborted) return null;
      if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey)!;
        if (cached.length > 0) {
          // For slash commands, prefix includes the leading slash to avoid double-slash bug
          const prefix = type === 'slash' ? '/' + token : token;
          return { items: cached, prefix };
        }
      }

      let suggestions: AutocompleteItem[] = [];
      if (options.signal.aborted) return null;

      if (type === 'slash') {
        suggestions = suggestSlashCommands(token);
      } else if (type === 'tool') {
        suggestions = suggestToolNames(token);
      }

      if (options.signal.aborted) return null;

      if (suggestions.length > 0) {
        cache.set(cacheKey, suggestions);
      }

      if (suggestions.length === 0) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      // For slash commands, prefix includes the leading slash
      const prefix = type === 'slash' ? '/' + token : token;
      return { items: suggestions, prefix };
    },

    applyCompletion(lines: string[], cursorLine: number, cursorCol: number, item: AutocompleteItem, prefix: string) {
      const currentLine = lines[cursorLine];
      const textBeforeCursor = currentLine.slice(0, cursorCol);
      const textAfterCursor = currentLine.slice(cursorCol);
      const tokenStart = textBeforeCursor.lastIndexOf(prefix);
      if (tokenStart === -1) {
        return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
      }
      const newLine = textBeforeCursor.slice(0, tokenStart) + item.value + textAfterCursor;
      const newLines = [...lines];
      newLines[cursorLine] = newLine;
      const newCursorCol = tokenStart + item.value.length;
      return { lines: newLines, cursorLine, cursorCol: newCursorCol };
    },

    shouldTriggerFileCompletion() {
      return false;
    },
  };
}

/**
 * Register global autocomplete provider
 */
export function registerGlobalAutocomplete(api: ExtensionAPI): void {
  const cache = new Map<string, AutocompleteItem[]>();

  api.on('session_start', (_event, ctx: any) => {
    if (ctx.ui?.addAutocompleteProvider) {
      ctx.ui.addAutocompleteProvider((current: any) =>
        createGlobalAutocompleteProvider(current, cache)
      );
    }
  });
}

export default registerGlobalAutocomplete;
