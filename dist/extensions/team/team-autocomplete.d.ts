#!/usr/bin/env node
/**
 * Team Run Autocomplete Provider
 *
 * Provides autocomplete for team_run tool parameters.
 * Demonstrates addAutocompleteProvider with team-specific contexts.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type AutocompleteItem, type AutocompleteProvider } from "@earendil-works/pi-tui";
/**
 * Create autocomplete provider
 */
export declare function createTeamRunAutocompleteProvider(current: AutocompleteProvider, cache: Map<string, AutocompleteItem[]>): AutocompleteProvider;
/**
 * Register autocomplete provider for team extension
 */
export declare function registerTeamRunAutocomplete(api: ExtensionAPI): void;
//# sourceMappingURL=team-autocomplete.d.ts.map