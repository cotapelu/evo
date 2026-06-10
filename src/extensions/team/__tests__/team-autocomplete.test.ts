#!/usr/bin/env node
/**
 * Team Run Autocomplete Provider - Basic Smoke Tests
 */

import { jest } from '@jest/globals';
import { createTeamRunAutocompleteProvider, registerTeamRunAutocomplete } from '../team-autocomplete.js';
import type { AutocompleteProvider, AutocompleteItem } from "@earendil-works/pi-tui";

// Mock current provider
const mockCurrent: AutocompleteProvider = {
	async getSuggestions(lines, cursorLine, cursorCol, options): Promise<AutocompleteSuggestions | null> {
		return { items: [], prefix: '' };
	},
	applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
		return { lines, cursorLine, cursorCol };
	},
	shouldTriggerFileCompletion() {
		return true;
	},
};

describe('Team Run Autocomplete Provider', () => {
	const cache = new Map<string, AutocompleteItem[]>();

	it('creates provider and can be called without throwing', async () => {
		const provider = createTeamRunAutocompleteProvider(mockCurrent, cache);
		// Basic interaction: call getSuggestions on unrelated text, should not throw
		await provider.getSuggestions(['hello world'], 0, 5, { signal: new AbortController().signal });
	});

	it('applyCompletion replaces prefix', () => {
		const provider = createTeamRunAutocompleteProvider(mockCurrent, cache);
		const lines = ["team_run({ teamRoles: ['pl']})"];
		const cursorCol = lines[0].indexOf('pl') + 2; // after 'pl'
		const item: AutocompleteItem = { value: 'planner', label: 'planner' };
		const result = provider.applyCompletion(lines, 0, cursorCol, item, 'pl');
		expect(result.lines[0]).toContain('planner');
	});

	it('registerTeamRunAutocomplete registers provider', () => {
		const addAutocomplete = jest.fn();
		const api: any = { 
			ui: { addAutocompleteProvider: addAutocomplete },
			on: jest.fn()
		};
		registerTeamRunAutocomplete(api);
		expect(addAutocomplete).toHaveBeenCalled();
	});
});
