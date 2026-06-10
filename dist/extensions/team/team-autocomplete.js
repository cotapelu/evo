#!/usr/bin/env node
/**
 * Team Run Autocomplete Provider
 *
 * Provides autocomplete for team_run tool parameters.
 * Demonstrates addAutocompleteProvider with team-specific contexts.
 */
import { fuzzyFilter, } from "@earendil-works/pi-tui";
import { TeamRegistry } from "./team-manager.js";
const MAX_SUGGESTIONS = 20;
// Common team roles
const COMMON_ROLES = ["planner", "coder", "reviewer", "tester", "docwriter", "researcher", "architect"];
/**
 * Extract token from text before cursor
 */
function extractToken(textBeforeCursor, pattern) {
    const match = textBeforeCursor.match(pattern);
    return match?.[1];
}
/**
 * Detect team_run context and current field
 */
function detectTeamRunContext(lines, cursorLine, cursorCol) {
    const currentLine = lines[cursorLine] ?? "";
    const textBeforeCursor = currentLine.slice(0, cursorCol);
    // team_run({ teamId: '...' })
    const teamIdMatch = extractToken(textBeforeCursor, /team_run\s*\(\s*\{[^}]*teamId\s*:\s*['"`]?([^\s'"`}]*)[`'"]?/i);
    if (teamIdMatch !== undefined) {
        return { field: "teamId", token: teamIdMatch };
    }
    // team_run({ teamSize: ... }) - numeric
    const teamSizeMatch = extractToken(textBeforeCursor, /team_run\s*\(\s*\{[^}]*teamSize\s*:\s*(\d*)/i);
    if (teamSizeMatch !== undefined) {
        return { field: "teamSize", token: teamSizeMatch };
    }
    // team_run({ teamRoles: ['...', ...] })
    const teamRolesMatch = extractToken(textBeforeCursor, /team_run\s*\(\s*\{[^}]*teamRoles\s*:\s*\[[^\]]*['"`]?([^\s'"`,\]]*)[`'"]?/i);
    if (teamRolesMatch !== undefined) {
        return { field: "teamRoles", token: teamRolesMatch };
    }
    // Also detect role inside array: ['planner', 'coder'] when typing after quote
    const insideArrayMatch = extractToken(textBeforeCursor, /,\s*['"`]?([^\s'"`,\]]*)[`'"]?/);
    if (insideArrayMatch && textBeforeCursor.includes('teamRoles')) {
        return { field: "teamRoles", token: insideArrayMatch };
    }
    return null;
}
/**
 * Filter roles with fuzzy matching
 */
function filterRoles(query) {
    if (!query.trim()) {
        return COMMON_ROLES.map(role => ({ value: role, label: role }));
    }
    const matches = fuzzyFilter(COMMON_ROLES, query, (r) => r);
    return matches.map(role => ({ value: role, label: role }));
}
/**
 * Suggest team IDs from registry (active teams)
 */
function suggestTeamIds(query) {
    try {
        const registry = TeamRegistry.getInstance();
        const teams = registry.getAll();
        const teamIds = Array.from(teams.keys()).sort();
        if (!query.trim()) {
            return teamIds.slice(0, MAX_SUGGESTIONS).map(id => ({ value: id, label: id.substring(0, 12), description: "team ID" }));
        }
        const matches = fuzzyFilter(teamIds, query, (id) => id);
        return matches.slice(0, MAX_SUGGESTIONS).map(id => ({ value: id, label: id.substring(0, 12), description: "team ID" }));
    }
    catch {
        return [];
    }
}
/**
 * Suggest team size (2-4)
 */
function suggestTeamSize(query) {
    const sizes = ["2", "3", "4"];
    if (!query.trim()) {
        return sizes.map(s => ({ value: s, label: s, description: "team size (2-4)" }));
    }
    const matches = fuzzyFilter(sizes, query, (s) => s);
    return matches.map(s => ({ value: s, label: s, description: "team size" }));
}
/**
 * Create autocomplete provider
 */
export function createTeamRunAutocompleteProvider(current, cache) {
    return {
        async getSuggestions(lines, cursorLine, cursorCol, options) {
            const context = detectTeamRunContext(lines, cursorLine, cursorCol);
            if (context === null) {
                return current.getSuggestions(lines, cursorLine, cursorCol, options);
            }
            const { field, token } = context;
            const cacheKey = `${field}:${token}`;
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
            switch (field) {
                case "teamId":
                    suggestions = suggestTeamIds(token);
                    break;
                case "teamSize":
                    suggestions = suggestTeamSize(token);
                    break;
                case "teamRoles":
                    suggestions = filterRoles(token);
                    break;
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
            return false;
        },
    };
}
/**
 * Register autocomplete provider for team extension
 */
export function registerTeamRunAutocomplete(api) {
    const cache = new Map();
    // Provider
    api.ui.addAutocompleteProvider((current) => createTeamRunAutocompleteProvider(current, cache));
}
//# sourceMappingURL=team-autocomplete.js.map