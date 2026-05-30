/**
 * Theme utilities for Evo Agent
 * Minimal implementation based on package theme
 */

// Minimal theme colors - will be overridden by initTheme
let currentTheme: any = null;

export function initTheme(name: string, silent: boolean): void {
	// For now, just set a minimal default
	currentTheme = {
		bold: (text: string) => text,
		fg: (color: string, text: string) => text,
		dim: (text: string) => text,
	} as any;
	// Try to merge with package theme if available
	try {
		const pkg = require('@earendil-works/pi-coding-agent');
		if (pkg?.theme) {
			currentTheme = { ...currentTheme, ...pkg.theme };
		}
	} catch (e) {
		// ignore
	}
}

export function theme(): any {
	if (!currentTheme) {
		initTheme('default', true);
	}
	return currentTheme;
}

export function getMarkdownTheme() {
	return {
		bold: (t: string) => t,
		italic: (t: string) => t,
		code: (t: string) => t,
		link: (t: string) => t,
	};
}

export function getSelectListTheme() {
	return {
		selected: (t: string) => t,
		active: (t: string) => t,
		disabled: (t: string) => t,
	};
}
