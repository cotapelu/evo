/**
 * Simple autocomplete provider for slash commands and file paths
 * Uses CombinedAutocompleteProvider from pi-tui
 */
import { CombinedAutocompleteProvider } from '@earendil-works/pi-tui';

export function createAutocompleteProvider(slashCommands: any[], fdPath?: string) {
	return new CombinedAutocompleteProvider(slashCommands, '', fdPath || null);
}
