#!/usr/bin/env node
/**
 * Session Manager Autocomplete Provider
 *
 * Provides context-aware autocomplete for the session_manager tool parameters.
 * Demonstrates ExtensionAPI.addAutocompleteProvider() capability.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	type AutocompleteItem,
	type AutocompleteProvider,
	type AutocompleteSuggestions,
	fuzzyFilter,
} from "@earendil-works/pi-tui";
import { readdir } from "node:fs/promises";
import { join, relative, extname, basename } from "node:path";

const MAX_SUGGESTIONS = 20;

// Per-session context captured via events
let sessionManager: any = null;
let sessionCwd: string | null = null;

// Operations for session_manager
const OPERATIONS = ["list", "info", "graph", "create", "switch", "fork", "import"];

// File extensions that are valid session files
const SESSION_EXTENSIONS = [".jsonl", ".json", ".pi"];

/**
 * Extract the current token being typed based on cursor position
 */
function extractToken(textBeforeCursor: string, pattern: RegExp): string | undefined {
	const match = textBeforeCursor.match(pattern);
	return match?.[1];
}

/**
 * Check if we're inside a session_manager(...) call
 */
function detectSessionManagerContext(lines: string[], cursorLine: number, cursorCol: number): { field: string; token: string } | null {
	const currentLine = lines[cursorLine] ?? "";
	const textBeforeCursor = currentLine.slice(0, cursorCol);

	// Detect: session_manager(operation: '...')
	const opMatch = extractToken(textBeforeCursor, /session_manager\s*\(\s*operation\s*:\s*['"`]?([^\s'"`)]*)[`'"]?/i);
	if (opMatch !== undefined) {
		return { field: "operation", token: opMatch };
	}

	// Detect: session_manager(..., sessionPath: '...')
	const sessionPathMatch = extractToken(textBeforeCursor, /session_manager\s*\([^)]*sessionPath\s*:\s*['"`]?([^\s'"`)]*)[`'"]?/i);
	if (sessionPathMatch !== undefined) {
		return { field: "sessionPath", token: sessionPathMatch };
	}

	// Detect: session_manager(..., importPath: '...')
	const importPathMatch = extractToken(textBeforeCursor, /session_manager\s*\([^)]*importPath\s*:\s*['"`]?([^\s'"`)]*)[`'"]?/i);
	if (importPathMatch !== undefined) {
		return { field: "importPath", token: importPathMatch };
	}

	// Detect: session_manager(..., entryId: '...')
	const entryIdMatch = extractToken(textBeforeCursor, /session_manager\s*\([^)]*entryId\s*:\s*['"`]?([^\s'"`)]*)[`'"]?/i);
	if (entryIdMatch !== undefined) {
		return { field: "entryId", token: entryIdMatch };
	}

	return null;
}

/**
 * Filter operations with fuzzy matching
 */
function filterOperations(query: string): AutocompleteItem[] {
	if (!query.trim()) {
		return OPERATIONS.map(op => ({ value: op, label: op }));
	}

	const matches = fuzzyFilter(OPERATIONS, query, (op) => op);
	return matches.map(op => ({ value: op, label: op }));
}

/**
 * Suggest session files from filesystem
 */
async function suggestSessionFiles(token: string): Promise<AutocompleteItem[]> {
	try {
		if (!sessionCwd) return [];
		const cwd = sessionCwd;

		// Read directory recursively (limited depth)
		const files: string[] = [];
		async function walk(dir: string, depth: number): Promise<void> {
			if (depth > 3) return; // Limit depth
			try {
				const entries = await readdir(dir, { withFileTypes: true });
				for (const entry of entries) {
					const fullPath = join(dir, entry.name);
					if (entry.isDirectory()) {
						if (['node_modules', '.git', 'dist', 'coverage', '.next', 'build'].includes(entry.name)) continue;
						await walk(fullPath, depth + 1);
					} else if (entry.isFile()) {
						const ext = extname(entry.name).toLowerCase();
						if (SESSION_EXTENSIONS.includes(ext)) {
							files.push(fullPath);
						}
					}
				}
			} catch {
				// ignore unreadable dirs
			}
		}
		await walk(cwd, 0);

		// Filter by token
		if (!token.trim()) {
			return files.slice(0, MAX_SUGGESTIONS).map(path => ({
				value: path,
				label: basename(path),
				description: relative(cwd, path),
			}));
		}

		// Fuzzy match on full path and filename
		const matches = fuzzyFilter(files, token, (f) => `${f} ${basename(f)}`);
		return matches.slice(0, MAX_SUGGESTIONS).map(path => ({
			value: path,
			label: basename(path),
			description: relative(cwd, path),
		}));
	} catch (e) {
		return [];
	}
}

/**
 * Suggest entry IDs from current session
 */
async function suggestEntryIds(token: string): Promise<AutocompleteItem[]> {
	try {
		if (!sessionManager) return [];

		const entries = sessionManager.getEntries();
		// Only suggest entry IDs (message entries)
		const entryIds: string[] = entries
			.filter((e: any) => e.type === 'message')
			.map((e: any) => String(e.id))
			.slice(-50); // Last 50 entries as string[]

		if (!token.trim()) {
			return entryIds.map(id => ({ value: id, label: id.substring(0, 12), description: "entry ID" }));
		}

		const matches = fuzzyFilter(entryIds, token, (id) => id) as string[];
		return matches.slice(0, MAX_SUGGESTIONS).map(id => ({
			value: id,
			label: id.substring(0, 12),
			description: "entry ID",
		}));
	} catch (e) {
		return [];
	}
}

/**
 * Create the autocomplete provider wrapping the current one
 */
export function createSessionManagerAutocompleteProvider(
	current: AutocompleteProvider,
	getSuggestionsCache: Map<string, AutocompleteItem[]>,
): AutocompleteProvider {
	return {
		async getSuggestions(lines: string[], cursorLine: number, cursorCol: number, options: any): Promise<AutocompleteSuggestions | null> {
			const context = detectSessionManagerContext(lines, cursorLine, cursorCol);
			if (context === null) {
				return current.getSuggestions(lines, cursorLine, cursorCol, options);
			}

			const { field, token } = context;

			// Check cache first
			const cacheKey = `${field}:${token}`;
			if (options.signal.aborted) return null;
			if (getSuggestionsCache.has(cacheKey)) {
				const cached = getSuggestionsCache.get(cacheKey)!;
				if (cached.length > 0) {
					return { items: cached, prefix: token };
				}
			}

			let suggestions: AutocompleteItem[] = [];

			if (options.signal.aborted) return null;

			switch (field) {
				case "operation":
					suggestions = filterOperations(token);
					break;
				case "sessionPath":
				case "importPath":
					suggestions = await suggestSessionFiles(token);
					break;
				case "entryId":
					suggestions = await suggestEntryIds(token);
					break;
			}

			if (options.signal.aborted) return null;

			// Cache results (except empty, so we retry)
			if (suggestions.length > 0) {
				getSuggestionsCache.set(cacheKey, suggestions);
			}

			if (suggestions.length === 0) {
				return current.getSuggestions(lines, cursorLine, cursorCol, options);
			}

			return {
				items: suggestions,
				prefix: token,
			};
		},

		applyCompletion(lines: string[], cursorLine: number, cursorCol: number, item: AutocompleteItem, prefix: string) {
			// Simple replacement: replace the token with the value
			const currentLine = lines[cursorLine];
			const textBeforeCursor = currentLine.slice(0, cursorCol);
			const textAfterCursor = currentLine.slice(cursorCol);

			// Find and replace the token
			const tokenStart = textBeforeCursor.lastIndexOf(prefix);
			if (tokenStart === -1) {
				return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
			}

			const newLine = textBeforeCursor.slice(0, tokenStart) + item.value + textAfterCursor;
			const newLines = [...lines];
			newLines[cursorLine] = newLine;
			const newCursorCol = tokenStart + item.value.length;

			return {
				lines: newLines,
				cursorLine,
				cursorCol: newCursorCol,
			};
		},

		shouldTriggerFileCompletion(lines: string[], cursorLine: number, cursorCol: number) {
			// Let default file completion work unless we're handling our own fields
			const context = detectSessionManagerContext(lines, cursorLine, cursorCol);
			if (context && (context.field === "sessionPath" || context.field === "importPath")) {
				// We provide file suggestions ourselves, so return false to avoid double-trigger
				return false;
			}
			return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
		},
	};
}

/**
 * Register the autocomplete provider
 */
export function registerSessionManagerAutocomplete(api: ExtensionAPI): void {
	const getSuggestionsCache = new Map<string, AutocompleteItem[]>();

	// Capture context from session_start events
	api.on("session_start", (_event, ctx) => {
		sessionManager = ctx.sessionManager;
		sessionCwd = ctx.cwd;
	});

	// Register autocomplete provider after session starts via UI context
	api.on('session_start', (_event, ctx: any) => {
		if (ctx.ui?.addAutocompleteProvider) {
			ctx.ui.addAutocompleteProvider((current: any) =>
				createSessionManagerAutocompleteProvider(current, getSuggestionsCache)
			);
		}
	});
}
