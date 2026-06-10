#!/usr/bin/env node
/**
 * Team Run Autocomplete Provider - Basic Tests
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
	shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
		return true;
	},
};

describe('Team Run Autocomplete Provider', () => {
	const cache = new Map<string, AutocompleteItem[]>();

	describe('provider creation', () => {
		it('creates provider without throwing', () => {
			expect(() => createTeamRunAutocompleteProvider(mockCurrent, cache)).not.toThrow();
		});

		it('returns null for non-team_run contexts', async () => {
			const provider = createTeamRunAutocompleteProvider(mockCurrent, cache);
			const lines = ['some other command'];
			const result = await provider.getSuggestions(lines, 0, 3, { signal: new AbortController().signal });
			expect(result).toBeNull();
		});

		it('delegates to current.getSuggestions when no context', async () => {
			const delegatingCurrent: AutocompleteProvider = {
				...mockCurrent,
				getSuggestions: jest.fn().mockResolvedValue({ items: [{value:'x',label:'x'} as AutocompleteItem], prefix: 'x' })
			};
			const provider = createTeamRunAutocompleteProvider(delegatingCurrent, cache);
			const lines = ['normal editing'];
			const result = await provider.getSuggestions(lines, 0, 3, { signal: new AbortController().signal });
			expect(delegatingCurrent.getSuggestions).toHaveBeenCalled();
		});

		it('applies completion: replaces token with value', () => {
			const provider = createTeamRunAutocompleteProvider(mockCurrent, cache);
			// Simulate line where cursor is after word 'old' inside quotes: team_run({ teamRoles: ['old']})
			// We'll call applyCompletion directly to test replacement logic
			const lines = ["team_run({ teamRoles: ['old']})"];
			const cursorCol = lines[0].indexOf('old') + 3; // after 'old'
			const item: AutocompleteItem = { value: 'new', label: 'new' };
			const result = provider.applyCompletion(lines, 0, cursorCol, item, 'old');
			expect(result.lines[0]).toContain('new');
		});

		it('disables file completion when inside team_run context (teamId)', () => {
			const provider = createTeamRunAutocompleteProvider(mockCurrent, cache);
			const lines = ['team_run({ teamId: '];
			expect(provider.shouldTriggerFileCompletion(lines, 0, lines[0].length)).toBe(false);
		});

		it('enables file completion for non-team_run contexts', () => {
			const provider = createTeamRunAutocompleteProvider(mockCurrent, cache);
			expect(provider.shouldTriggerFileCompletion(['normal text'], 0, 5)).toBe(true);
		});
	});

	describe('registerTeamRunAutocomplete', () => {
		it('registers with api without throwing', () => {
			const api: any = { 
				ui: { addAutocompleteProvider: jest.fn() },
				on: jest.fn()
			};
			expect(() => registerTeamRunAutocomplete(api)).not.toThrow();
			expect(api.ui.addAutocompleteProvider).toHaveBeenCalled();
		});
	});
});
