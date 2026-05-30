/**
 * Minimal KeybindingsManager implementation for Evo Agent
 * Provides keybinding matching functionality
 */

import { TUI_KEYBINDINGS, matchesKey } from '@earendil-works/pi-tui';

export class KeybindingsManager {
	private keysById = new Map<string, string[]>();

	constructor() {
		// Initialize with TUI keybindings
		for (const [id, def] of Object.entries(TUI_KEYBINDINGS)) {
			const keys = Array.isArray(def.defaultKeys) ? def.defaultKeys : [def.defaultKeys];
			this.keysById.set(id, keys);
		}
		// Add app-specific keybindings
		const appKeybindings: Record<string, string | string[]> = {
			'app.interrupt': 'escape',
			'app.clear': 'ctrl+c',
			'app.exit': 'ctrl+d',
			'app.suspend': process.platform === 'win32' ? [] : 'ctrl+z',
			'app.thinking.cycle': 'shift+tab',
			'app.model.cycleForward': 'ctrl+p',
			'app.model.cycleBackward': 'shift+ctrl+p',
			'app.model.select': 'ctrl+l',
			'app.tools.expand': 'ctrl+o',
			'app.thinking.toggle': 'ctrl+t',
			'app.clipboard.pasteImage': process.platform === 'win32' ? 'alt+v' : 'ctrl+v',
			'app.editor.external': 'ctrl+g',
			'app.message.followUp': 'alt+enter',
			'app.message.dequeue': 'alt+up',
		};
		for (const [id, keys] of Object.entries(appKeybindings)) {
			this.keysById.set(id, Array.isArray(keys) ? keys : [keys]);
		}
	}

	/**
	 * Check if input data matches a keybinding
	 */
	matches(data: string, keybinding: string): boolean {
		const keys = this.keysById.get(keybinding) || [];
		for (const key of keys) {
			// @ts-expect-error matchesKey expects KeyId but string works at runtime
			if (matchesKey(data, key)) return true;
		}
		return false;
	}

	/**
	 * Get the primary key for a binding
	 */
	getKey(binding: string): string {
		const keys = this.keysById.get(binding);
		return keys && keys.length > 0 ? keys[0] : '';
	}

	/**
	 * Get all keys for a binding
	 */
	getKeys(binding: string): string[] {
		return this.keysById.get(binding) || [];
	}

	/**
	 * Create a new instance
	 */
	static create(): KeybindingsManager {
		return new KeybindingsManager();
	}
}
