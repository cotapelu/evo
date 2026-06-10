#!/usr/bin/env node
/**
 * Global Autocomplete Provider - Smoke Tests
 */

import { jest } from '@jest/globals';
import { createGlobalAutocompleteProvider } from '../global-autocomplete.js';
import globalAutocompleteExtension from '../index.js';
import type { AutocompleteProvider, AutocompleteItem } from "@earendil-works/pi-tui";

// Mock current provider (returns null by default to simulate no suggestions)
const mockCurrent: AutocompleteProvider = {
	async getSuggestions(lines, cursorLine, cursorCol, options): Promise<AutocompleteSuggestions | null> {
		return null;
	},
	applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
		return { lines, cursorLine, cursorCol };
	},
	shouldTriggerFileCompletion() {
		return true;
	},
};

describe('Global Autocomplete Provider', () => {
	const cache = new Map<string, AutocompleteItem[]>();

	describe('provider functionality', () => {
		it('suggests slash commands when typing /', async () => {
			const provider = createGlobalAutocompleteProvider(mockCurrent, cache);
			const lines = ['/mem'];
			const result = await provider.getSuggestions(lines, 0, 4, { signal: new AbortController().signal });
			expect(result).not.toBeNull();
			expect(result!.items.length).toBeGreaterThan(0);
			expect(result!.items.some(i => i.value.includes('memory'))).toBe(true);
		});

		it('suggests tools when typing tool name before (', async () => {
			const provider = createGlobalAutocompleteProvider(mockCurrent, cache);
			const lines = ['todos(']; // cursor after '('
			const result = await provider.getSuggestions(lines, 0, 6, { signal: new AbortController().signal });
			expect(result).not.toBeNull();
			expect(result!.items.some(i => i.value === 'todos')).toBe(true);
		});

		it('returns null for unrelated text', async () => {
			const provider = createGlobalAutocompleteProvider(mockCurrent, cache);
			const result = await provider.getSuggestions(['hello world'], 0, 5, { signal: new AbortController().signal });
			expect(result).toBeNull();
		});
	});

	describe('extension registration', () => {
		it('registers provider via extension default export', () => {
			const api: any = { ui: { addAutocompleteProvider: jest.fn() } };
			expect(() => globalAutocompleteExtension(api)).not.toThrow();
			expect(api.ui.addAutocompleteProvider).toHaveBeenCalled();
		});
	});
});
