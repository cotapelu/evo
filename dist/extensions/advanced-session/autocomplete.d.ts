#!/usr/bin/env node
/**
 * Session Manager Autocomplete Provider
 *
 * Provides context-aware autocomplete for the session_manager tool parameters.
 * Demonstrates ExtensionAPI.addAutocompleteProvider() capability.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type AutocompleteItem, type AutocompleteProvider } from "@earendil-works/pi-tui";
/**
 * Create the autocomplete provider wrapping the current one
 */
export declare function createSessionManagerAutocompleteProvider(current: AutocompleteProvider, getSuggestionsCache: Map<string, AutocompleteItem[]>): AutocompleteProvider;
/**
 * Register the autocomplete provider
 */
export declare function registerSessionManagerAutocomplete(api: ExtensionAPI): void;
//# sourceMappingURL=autocomplete.d.ts.map