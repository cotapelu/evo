/**
 * Theme Management for Evo Agent
 *
 * Provides theme object with color functions and dynamic border colors.
 * Integrates with @earendil-works/pi-coding-agent theme system.
 */
/**
 * Initialize theme system with a specific theme name.
 * Loads theme from pi-coding-agent and sets up watcher for file changes.
 *
 * Note: pi-coding-agent's initTheme loads theme files but doesn't return the theme object.
 * We'll use getThemeByName after init to retrieve it.
 */
export declare function initTheme(name: string, silent?: boolean): void;
/**
 * Get the current theme object.
 * Ensures theme is initialized before access.
 */
export declare function theme(): any;
/**
 * Get markdown theme with settings-adjusted code block indent.
 */
export declare function getMarkdownTheme(settings?: {
    codeBlockIndent?: number;
}): any;
/**
 * Get editor theme for CustomEditor component.
 */
export declare function getEditorTheme(): any;
/**
 * Get select list theme for dropdowns/selectors.
 */
export declare function getSelectListTheme(): any;
/**
 * Get border color for bash mode (green accent).
 */
export declare function getBashModeBorderColor(): (str: string) => string;
/**
 * Get border color based on thinking level.
 */
export declare function getThinkingBorderColor(level: string): (str: string) => string;
/**
 * Stop theme file watcher (cleanup on shutdown)
 */
export declare function stopThemeWatcher(): void;
/**
 * Get all available themes with their names.
 * Currently returns a static list; can be extended if package exports API.
 */
export declare function getAvailableThemes(): Promise<string[]>;
/**
 * Get theme by name.
 */
export declare function getThemeByName(name: string): any;
/**
 * Set a theme (returns result indicating success/error).
 */
export declare function setTheme(name: string, silent?: boolean): {
    success: boolean;
    error?: string;
};
/**
 * Set theme instance directly.
 */
export declare function setThemeInstance(themeObj: any): void;
//# sourceMappingURL=theme.d.ts.map