/**
 * Simple autocomplete provider for slash commands only
 */
import type { AutocompleteProvider, AutocompleteSuggestions, AutocompleteItem } from '@earendil-works/pi-tui';

export class SlashAutocompleteProvider implements AutocompleteProvider {
	private commands: { name: string; description?: string }[];

	constructor(commands: { name: string; description?: string }[]) {
		this.commands = commands;
	}

	async getSuggestions(
		lines: string[],
		cursorLine: number,
		cursorCol: number,
		options: { signal: AbortSignal; force?: boolean }
	): Promise<AutocompleteSuggestions | null> {
		const line = lines[cursorLine] || '';
		const prefixEnd = cursorCol;
		// Find the slash prefix (from start of line to cursor)
		const beforeCursor = line.slice(0, prefixEnd);
		// Check if we're after a slash
		const slashIndex = beforeCursor.lastIndexOf('/');
		if (slashIndex === -1) return null;

		const prefix = beforeCursor.slice(slashIndex + 1);
		if (prefix.includes(' ')) return null; // don't autocomplete after space

		const items: AutocompleteItem[] = this.commands
			.filter(cmd => cmd.name.startsWith(prefix))
			.map(cmd => ({
				value: cmd.name,
				label: cmd.name,
				description: cmd.description,
			}));

		if (items.length === 0) return null;

		return {
			items,
			prefix: '/' + prefix,
		};
	}

	applyCompletion(
		lines: string[],
		cursorLine: number,
		cursorCol: number,
		item: AutocompleteItem,
		prefix: string
	): { lines: string[]; cursorLine: number; cursorCol: number } {
		const line = lines[cursorLine];
		const beforeCursor = line.slice(0, cursorCol);
		const afterCursor = line.slice(cursorCol);
		// Replace the prefix with the completed command
		const newLine = beforeCursor.slice(0, beforeCursor.lastIndexOf(prefix)) + item.value + afterCursor;
		const newLines = [...lines];
		newLines[cursorLine] = newLine;
		const newCursorCol = cursorCol - prefix.length + item.value.length;
		return { lines: newLines, cursorLine: cursorLine, cursorCol: newCursorCol };
	}
}
