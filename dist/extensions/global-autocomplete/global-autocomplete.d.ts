#!/usr/bin/env node
/**
 * Global Command & Tool Autocomplete Provider
 *
 * Provides suggestions for slash commands and tool names across the app.
 * Demonstrates advanced context detection and fuzzy matching.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type AutocompleteItem, type AutocompleteProvider } from "@earendil-works/pi-tui";
/**
 * Create global autocomplete provider
 */
export declare function createGlobalAutocompleteProvider(current: AutocompleteProvider, cache: Map<string, AutocompleteItem[]>): AutocompleteProvider;
/**
 * Register global autocomplete provider
 */
export declare function registerGlobalAutocomplete(api: ExtensionAPI): void;
export default registerGlobalAutocomplete;
//# sourceMappingURL=global-autocomplete.d.ts.map