/**
 * Theme Management for Evo Agent
 *
 * Provides theme object with color functions and dynamic border colors.
 * Integrates with @earendil-works/pi-coding-agent theme system.
 */

import type { ThemeColor } from '@earendil-works/pi-coding-agent';
import type { EditorTheme, SelectListTheme, SettingsListTheme, MarkdownTheme } from '@earendil-works/pi-tui';

// Use ThemeColor imported from package

// Theme background colors
type ThemeBg = 'selectedBg' | 'userMessageBg' | 'customMessageBg' | 'toolPendingBg' | 'toolSuccessBg' | 'toolErrorBg';

type ColorMode = "truecolor" | "256color";

// ============================================================================
// Theme Class
// ============================================================================

export class Theme {
	private fgColors: Record<ThemeColor, string | number>;
	private bgColors: Record<ThemeBg, string | number>;
	private mode: ColorMode;
	public readonly name?: string;
	public readonly sourcePath?: string;
	public sourceInfo?: any;

	constructor(
		fgColors: Record<ThemeColor, string | number>,
		bgColors: Record<ThemeBg, string | number>,
		mode: ColorMode,
		options?: { name?: string; sourcePath?: string; sourceInfo?: any }
	) {
		this.fgColors = fgColors;
		this.bgColors = bgColors;
		this.mode = mode;
		this.name = options?.name;
		this.sourcePath = options?.sourcePath;
		this.sourceInfo = options?.sourceInfo;
	}

	/** Get foreground color for a theme color key */
	fg(color: ThemeColor, text: string): string {
		const value = this.fgColors[color];
		if (value === undefined) return text;
		return this.applyFg(value, text);
	}

	/** Get background color for a theme bg key */
	bg(color: ThemeBg, text: string): string {
		const value = this.bgColors[color];
		if (value === undefined) return text;
		return this.applyBg(value, text);
	}

	/** Bold text */
	bold(text: string): string {
		return `\x1b[1m${text}\x1b[22m`;
	}

	/** Italic text */
	italic(text: string): string {
		return `\x1b[3m${text}\x1b[23m`;
	}

	/** Underline text */
	underline(text: string): string {
		return `\x1b[4m${text}\x1b[24m`;
	}

	/** Inverse (swap fg/bg) */
	inverse(text: string): string {
		return `\x1b[7m${text}\x1b[27m`;
	}

	/** Strikethrough text */
	strikethrough(text: string): string {
		return `\x1b[9m${text}\x1b[29m`;
	}

	/** Get raw ANSI code for foreground */
	getFgAnsi(color: ThemeColor): string {
		const value = this.fgColors[color];
		if (value === undefined) return '';
		return this.fgAnsi(value);
	}

	/** Get raw ANSI code for background */
	getBgAnsi(color: ThemeBg): string {
		const value = this.bgColors[color];
		if (value === undefined) return '';
		return this.bgAnsi(value);
	}

	/** Get color mode */
	getColorMode(): ColorMode {
		return this.mode;
	}

	/** Get thinking level border color function */
	getThinkingBorderColor(level: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'): (str: string) => string {
		const map: Record<string, ThemeColor> = {
			off: 'thinkingOff',
			minimal: 'thinkingMinimal',
			low: 'thinkingLow',
			medium: 'thinkingMedium',
			high: 'thinkingHigh',
			xhigh: 'thinkingXhigh',
		};
		const colorKey = map[level] || 'thinkingOff';
		return (str: string) => this.fg(colorKey, str);
	}

	/** Get bash mode border color function */
	getBashModeBorderColor(): (str: string) => string {
		return (str: string) => this.fg('bashMode', str);
	}

	/** Convert value to foreground ANSI */
	private applyFg(value: string | number, text: string): string {
		if (value === '') return `\x1b[39m${text}`;
		if (typeof value === 'number') return `\x1b[38;5;${value}m${text}\x1b[39m`;
		if (typeof value === 'string' && value.startsWith('#')) {
			if (this.mode === 'truecolor') {
				const rgb = this.hexToRgb(value);
				return `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m${text}\x1b[39m`;
			} else {
				const idx = this.hexTo256(value);
				return `\x1b[38;5;${idx}m${text}\x1b[39m`;
			}
		}
		return text;
	}

	/** Convert value to background ANSI */
	private applyBg(value: string | number, text: string): string {
		if (value === '') return `\x1b[49m${text}`;
		if (typeof value === 'number') return `\x1b[48;5;${value}m${text}\x1b[49m`;
		if (typeof value === 'string' && value.startsWith('#')) {
			if (this.mode === 'truecolor') {
				const rgb = this.hexToRgb(value);
				return `\x1b[48;2;${rgb.r};${rgb.g};${rgb.b}m${text}\x1b[49m`;
			} else {
				const idx = this.hexTo256(value);
				return `\x1b[48;5;${idx}m${text}\x1b[49m`;
			}
		}
		return text;
	}

	/** Convert hex to RGB */
	private hexToRgb(hex: string): { r: number; g: number; b: number } {
		const cleaned = hex.replace('#', '');
		if (cleaned.length !== 6) return { r: 0, g: 0, b: 0 };
		const r = parseInt(cleaned.substring(0, 2), 16);
		const g = parseInt(cleaned.substring(2, 4), 16);
		const b = parseInt(cleaned.substring(4, 6), 16);
		return { r: isNaN(r) ? 0 : r, g: isNaN(g) ? 0 : g, b: isNaN(b) ? 0 : b };
	}

	/** Convert hex to 256-color index */
	private hexTo256(hex: string): number {
		const { r, g, b } = this.hexToRgb(hex);
		// Simplified: map to nearest 216-color cube
		const toIdx = (c: number) => Math.round((c / 255) * 5);
		const rIdx = toIdx(r);
		const gIdx = toIdx(g);
		const bIdx = toIdx(b);
		return 16 + 36 * rIdx + 6 * gIdx + bIdx;
	}

	/** Get ANSI code for a foreground value */
	private fgAnsi(value: string | number): string {
		if (value === '') return '\x1b[39m';
		if (typeof value === 'number') return `\x1b[38;5;${value}m`;
		if (typeof value === 'string' && value.startsWith('#')) {
			if (this.mode === 'truecolor') {
				const rgb = this.hexToRgb(value);
				return `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m`;
			} else {
				return `\x1b[38;5;${this.hexTo256(value)}m`;
			}
		}
		return '';
	}

	/** Get ANSI code for a background value */
	private bgAnsi(value: string | number): string {
		if (value === '') return '\x1b[49m';
		if (typeof value === 'number') return `\x1b[48;5;${value}m`;
		if (typeof value === 'string' && value.startsWith('#')) {
			if (this.mode === 'truecolor') {
				const rgb = this.hexToRgb(value);
				return `\x1b[48;2;${rgb.r};${rgb.g};${rgb.b}m`;
			} else {
				return `\x1b[48;5;${this.hexTo256(value)}m`;
			}
		}
		return '';
	}
}

// ============================================================================
// Theme Registry & Global State
// ============================================================================

/** Registry of all available themes (built-in + custom) */
const registeredThemes = new Map<string, Theme>();

/** Global theme instance */
let globalTheme: Theme = getBuiltInTheme('dark');

/** Current active theme name */
let currentThemeName: string = 'dark';

/** onThemeChange callback */
let onThemeChangeCallback: (() => void) | null = null;

/** Theme watcher for custom themes */
let themeWatcher: (() => void) | null = null;
let themeReloadTimer: NodeJS.Timeout | null = null;

// ============================================================================
// Built-in Themes
// ============================================================================

function getBuiltInTheme(name: 'dark' | 'light'): Theme {
	if (name === 'light') {
		return new Theme(
			{
				accent: '#0066cc', border: '#cccccc', borderAccent: '#0066cc', borderMuted: '#e0e0e0',
				success: '#00aa00', error: '#cc0000', warning: '#ff8800', muted: '#666666', dim: '#999999',
				text: '#333333', thinkingText: '#666666', userMessageText: '#000000', customMessageText: '#000000',
				customMessageLabel: '#0066cc', toolTitle: '#333333', toolOutput: '#000000', mdHeading: '#0066cc',
				mdLink: '#0066cc', mdLinkUrl: '#0066cc', mdCode: '#cc6600', mdCodeBlock: '#f5f5f5',
				mdCodeBlockBorder: '#cccccc', mdQuote: '#999999', mdQuoteBorder: '#cccccc', mdHr: '#cccccc',
				mdListBullet: '#0066cc', toolDiffAdded: '#00aa00', toolDiffRemoved: '#cc0000',
				toolDiffContext: '#999999', syntaxComment: '#999999', syntaxKeyword: '#0066cc',
				syntaxFunction: '#cc6600', syntaxVariable: '#333333', syntaxString: '#aa0000',
				syntaxNumber: '#aa00aa', syntaxType: '#008800', syntaxOperator: '#666666',
				syntaxPunctuation: '#333333', thinkingOff: '#cccccc', thinkingMinimal: '#999999',
				thinkingLow: '#88aacc', thinkingMedium: '#6688cc', thinkingHigh: '#4477aa',
				thinkingXhigh: '#2255aa', bashMode: '#00aa00'
			},
			{
				selectedBg: '#e6f2ff', userMessageBg: '#e6f2ff', customMessageBg: '#f0f0f0',
				toolPendingBg: '#f0f0f0', toolSuccessBg: '#d0ffd0', toolErrorBg: '#ffd0d0'
			},
			'256color',
			{ name: 'light' }
		);
	}
	// Dark theme
	return new Theme(
		{
			accent: '#4da6ff', border: '#404040', borderAccent: '#4da6ff', borderMuted: '#555555',
			success: '#00cc00', error: '#ff3333', warning: '#ff9933', muted: '#999999', dim: '#666666',
			text: '#e0e0e0', thinkingText: '#b0b0b0', userMessageText: '#ffffff', customMessageText: '#ffffff',
			customMessageLabel: '#4da6ff', toolTitle: '#e0e0e0', toolOutput: '#d0d0d0', mdHeading: '#4da6ff',
			mdLink: '#4da6ff', mdLinkUrl: '#4da6ff', mdCode: '#ff9933', mdCodeBlock: '#1a1a1a',
			mdCodeBlockBorder: '#404040', mdQuote: '#999999', mdQuoteBorder: '#505050', mdHr: '#505050',
			mdListBullet: '#4da6ff', toolDiffAdded: '#00cc00', toolDiffRemoved: '#ff3333',
			toolDiffContext: '#666666', syntaxComment: '#999999', syntaxKeyword: '#ff79c6',
			syntaxFunction: '#50fa7b', syntaxVariable: '#f8f8f2', syntaxString: '#f1fa8c',
			syntaxNumber: '#bd93f9', syntaxType: '#8be9fd', syntaxOperator: '#ff79c6',
			syntaxPunctuation: '#f8f8f2', thinkingOff: '#505050', thinkingMinimal: '#606060',
			thinkingLow: '#707070', thinkingMedium: '#808080', thinkingHigh: '#909090',
			thinkingXhigh: '#a0a0a0', bashMode: '#00cc00'
		},
		{
			selectedBg: '#1e3a5f', userMessageBg: '#1e3a5f', customMessageBg: '#262626',
			toolPendingBg: '#2a2a2a', toolSuccessBg: '#1a331a', toolErrorBg: '#331a1a'
		},
		'256color',
		{ name: 'dark' }
	);
}

function setGlobalTheme(theme: Theme): void {
	globalTheme = theme;
}

// ============================================================================
// Public API Functions
// ============================================================================

export function setRegisteredThemes(themes: Theme[]): void {
	registeredThemes.clear();
	for (const theme of themes) {
		if (theme.name) {
			registeredThemes.set(theme.name, theme);
		}
	}
}

export function getThemeFromRegistry(name: string): Theme | undefined {
	return registeredThemes.get(name);
}

export function getThemeByName(name: string): Theme | undefined {
	// Check registry first
	const fromRegistry = getThemeFromRegistry(name);
	if (fromRegistry) return fromRegistry;
	// Fallback to built-in
	if (name === 'dark' || name === 'light') {
		return getBuiltInTheme(name as 'dark' | 'light');
	}
	return undefined;
}

export function loadThemeFromPath(themePath: string): Theme {
	// In full implementation, read and parse theme JSON file
	// For now, fall back to dark
	console.warn('[Theme] loadThemeFromPath not fully implemented, falling back to dark theme');
	return getBuiltInTheme('dark');
}

export function getDefaultTheme(): string {
	return 'dark';
}

export async function getAvailableThemesWithPaths(): Promise<{ name: string; path: string | undefined }[]> {
	return [
		{ name: 'dark', path: undefined },
		{ name: 'light', path: undefined },
	];
}

export function initTheme(themeName?: string, enableWatcher: boolean = false): void {
	const name = themeName ?? getDefaultTheme();
	currentThemeName = name;
	try {
		let theme = getThemeByName(name);
		if (!theme) {
			theme = getBuiltInTheme('dark');
		}
		setGlobalTheme(theme);
		// Watcher not implemented in simplified version
	} catch (error) {
		currentThemeName = 'dark';
		setGlobalTheme(getBuiltInTheme('dark'));
	}
}

export function setTheme(name: string, enableWatcher: boolean = false): { success: boolean; error?: string } {
	currentThemeName = name;
	try {
		let theme = getThemeByName(name);
		if (!theme) {
			if (name === 'dark' || name === 'light') {
				theme = getBuiltInTheme(name as 'dark' | 'light');
			} else {
				return { success: false, error: `Theme '${name}' not found` };
			}
		}
		setGlobalTheme(theme);
		// Watcher not implemented
		if (onThemeChangeCallback) {
			onThemeChangeCallback();
		}
		return { success: true };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export function setThemeInstance(themeInstance: Theme): void {
	setGlobalTheme(themeInstance);
	currentThemeName = '<in-memory>';
	// stopThemeWatcher() not needed in simplified version
	if (onThemeChangeCallback) {
		onThemeChangeCallback();
	}
}

export function onThemeChange(callback: () => void): void {
	onThemeChangeCallback = callback;
}

export function getCurrentThemeName(): string {
	return currentThemeName;
}

export function theme(): Theme {
	return globalTheme;
}

// Additional theme API functions for compatibility with pi-coding-agent components

/** Get editor theme for CustomEditor component. */
export function getEditorTheme(): EditorTheme {
	const th = globalTheme;
	return {
		borderColor: (status: string) => th.fg('border', status),
		selectList: {
			selectedPrefix: (text: string) => th.fg('accent', text),
			selectedText: (text: string) => th.fg('accent', text),
			description: (text: string) => th.fg('muted', text),
			scrollInfo: (text: string) => th.fg('muted', text),
			noMatch: (text: string) => th.fg('muted', text),
		},
	};
}

/** Get select list theme for dropdowns/selectors. */
export function getSelectListTheme(): SelectListTheme {
	const th = globalTheme;
	return {
		selectedPrefix: (text: string) => th.fg('accent', text),
		selectedText: (text: string) => th.fg('accent', text),
		description: (text: string) => th.fg('muted', text),
		scrollInfo: (text: string) => th.fg('muted', text),
		noMatch: (text: string) => th.fg('muted', text),
	};
}

/** Get border color for bash mode (green accent). */
export function getBashModeBorderColor(): (str: string) => string {
	const th = globalTheme;
	return th.getBashModeBorderColor();
}

/** Get border color based on thinking level. */
export function getThinkingBorderColor(level: string): (str: string) => string {
	const th = globalTheme;
	return th.getThinkingBorderColor(level as any);
}

