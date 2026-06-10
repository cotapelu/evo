#!/usr/bin/env node
/**
 * Global Command & Tool Autocomplete Provider
 *
 * Provides suggestions for slash commands and tool names across the app.
 * Demonstrates advanced context detection and fuzzy matching.
 */
import { fuzzyFilter, } from "@earendil-works/pi-tui";
const MAX_SUGGESTIONS = 20;
// Known slash commands (from typical extensions)
const KNOWN_SLASH_COMMANDS = [
    'sessions', // advanced-session
    'session', // advanced-session alias
    'todos', // todos tool
    'memory', // memory tool
    'notes', // notes tool
    'metrics', // metrics tool
    'tool-metrics', // tool-metrics tool
    'coverage', // coverage tool
    'coverage-history',
    'git', // git tool
    'test', // test-runner tool
    'code-health', // code-health tool
    'format', // format tool
    'security-audit',
    'kicad-sch',
    'kicad-pcb',
    'watch', // watch tool
    'about', // about command
    'gnpi', // auto-continue
    'team', // team extension hint
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
function detectGlobalContext(lines, cursorLine, cursorCol) {
    const currentLine = lines[cursorLine] ?? "";
    const textBeforeCursor = currentLine.slice(0, cursorCol);
    // Slash command: starts with '/' and then word characters
    const slashMatch = textBeforeCursor.match(/^\/([a-z0-9_-]*)$/i);
    if (slashMatch) {
        return { type: 'slash', token: slashMatch[1] };
    }
    // Tool call: word followed by '(' (within reasonable distance)
    // Look back up to 30 chars for pattern: word(
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
function suggestSlashCommands(query) {
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
function suggestToolNames(query) {
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
export function createGlobalAutocompleteProvider(current, cache) {
    return {
        async getSuggestions(lines, cursorLine, cursorCol, options) {
            const context = detectGlobalContext(lines, cursorLine, cursorCol);
            if (context === null) {
                return current.getSuggestions(lines, cursorLine, cursorCol, options);
            }
            const { type, token } = context;
            const cacheKey = `${type}:${token}`;
            if (options.signal.aborted)
                return null;
            if (cache.has(cacheKey)) {
                const cached = cache.get(cacheKey);
                if (cached.length > 0) {
                    return { items: cached, prefix: token };
                }
            }
            let suggestions = [];
            if (options.signal.aborted)
                return null;
            if (type === 'slash') {
                suggestions = suggestSlashCommands(token);
            }
            else if (type === 'tool') {
                suggestions = suggestToolNames(token);
            }
            if (options.signal.aborted)
                return null;
            if (suggestions.length > 0) {
                cache.set(cacheKey, suggestions);
            }
            if (suggestions.length === 0) {
                return current.getSuggestions(lines, cursorLine, cursorCol, options);
            }
            return { items: suggestions, prefix: token };
        },
        applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
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
            // No file completion
            return false;
        },
    };
}
/**
 * Register global autocomplete provider
 */
export function registerGlobalAutocomplete(api) {
    const cache = new Map();
    api.ui.addAutocompleteProvider((current) => createGlobalAutocompleteProvider(current, cache));
}
//# sourceMappingURL=global-autocomplete.js.map