/**
 * Theme Management for Evo Agent
 *
 * Provides theme object with color functions and dynamic border colors.
 * Integrates with @earendil-works/pi-coding-agent theme system.
 */
// Minimal default theme (fallback)
const defaultTheme = {
    bold: (t) => t,
    fg: (_, t) => t,
    bg: (_, t) => t,
    dim: (t) => t,
    italic: (t) => t,
    code: (t) => t,
    mdLink: (t) => t,
};
// Current theme instance (initialized by initTheme)
let currentTheme = defaultTheme;
let themeWatcher = null;
/**
 * Initialize theme system with a specific theme name.
 * Loads theme from pi-coding-agent and sets up watcher for file changes.
 *
 * Note: pi-coding-agent's initTheme loads theme files but doesn't return the theme object.
 * We'll use getThemeByName after init to retrieve it.
 */
export function initTheme(name, silent = false) {
    // Dynamically import to avoid static dependency issues
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pkg = require('@earendil-works/pi-coding-agent');
        if (pkg?.initTheme) {
            pkg.initTheme(name, silent);
        }
        // Attempt to get the theme by name after init
        if (pkg?.getThemeByName) {
            const theme = pkg.getThemeByName(name);
            if (theme) {
                currentTheme = theme;
            }
        }
    }
    catch (e) {
        // Ignore errors, fallback to default
        if (!silent) {
            console.error('[Theme] Failed to initialize theme:', e);
        }
    }
    // Setup file watcher if available
    if (!silent) {
        themeWatcher?.();
        try {
            const pkg = require('@earendil-works/pi-coding-agent');
            if (pkg?.onThemeChange && typeof pkg.onThemeChange === 'function') {
                themeWatcher = pkg.onThemeChange(() => {
                    // Refresh current theme from package
                    try {
                        if (pkg.getThemeByName) {
                            const name = getCurrentThemeName() ?? 'dark';
                            currentTheme = pkg.getThemeByName(name) ?? defaultTheme;
                        }
                    }
                    catch {
                        // ignore
                    }
                });
            }
        }
        catch {
            // ignore
        }
    }
}
/**
 * Get the current theme name from settings if possible (best effort).
 */
function getCurrentThemeName() {
    try {
        // Try to get from settings via pi-coding-agent's SettingsManager (not trivial)
        // For now, just return the name we last set? We don't store it.
        // This is a simplification; in practice we might store name separately.
    }
    catch {
        // ignore
    }
    return 'dark';
}
/**
 * Get the current theme object.
 * Ensures theme is initialized before access.
 */
export function theme() {
    if (!currentTheme) {
        initTheme('dark', true);
    }
    return currentTheme;
}
/**
 * Get markdown theme with settings-adjusted code block indent.
 */
export function getMarkdownTheme(settings) {
    const base = {
        bold: (t) => theme().bold(t),
        italic: (t) => theme().italic?.(t) ?? t,
        code: (t) => theme().code(t),
        link: (t) => theme().mdLink?.(t) ?? t,
        codeBlockIndent: settings?.codeBlockIndent ?? 2,
    };
    return base;
}
/**
 * Get editor theme for CustomEditor component.
 */
export function getEditorTheme() {
    const th = theme();
    // Ensure theme has fg method
    const safeFg = (color, text) => {
        if (typeof th?.fg === 'function') {
            return th.fg(color, text);
        }
        // Fallback to plain text
        return text;
    };
    return {
        borderColor: (status) => safeFg('border', status),
        selectList: {
            selectedPrefix: (text) => safeFg('accent', text),
            selectedText: (text) => safeFg('accent', text),
            description: (text) => safeFg('muted', text),
            scrollInfo: (text) => safeFg('muted', text),
            noMatch: (text) => safeFg('muted', text),
        },
    };
}
/**
 * Get select list theme for dropdowns/selectors.
 */
export function getSelectListTheme() {
    const th = theme();
    return {
        selectedPrefix: (text) => th.fg('accent', text),
        selectedText: (text) => th.fg('accent', text),
        description: (text) => th.fg('muted', text),
        scrollInfo: (text) => th.fg('muted', text),
        noMatch: (text) => th.fg('muted', text),
    };
}
/**
 * Get border color for bash mode (green accent).
 */
export function getBashModeBorderColor() {
    const th = theme();
    return (str) => th.fg('bashMode', str);
}
/**
 * Get border color based on thinking level.
 */
export function getThinkingBorderColor(level) {
    const th = theme();
    const levelColors = {
        off: (str) => th.fg('thinkingOff', str),
        minimal: (str) => th.fg('thinkingMinimal', str),
        low: (str) => th.fg('thinkingLow', str),
        medium: (str) => th.fg('thinkingMedium', str),
        high: (str) => th.fg('thinkingHigh', str),
        xhigh: (str) => th.fg('thinkingXhigh', str),
    };
    return levelColors[level] ?? ((str) => th.fg('thinkingOff', str));
}
/**
 * Stop theme file watcher (cleanup on shutdown)
 */
export function stopThemeWatcher() {
    if (themeWatcher) {
        themeWatcher();
        themeWatcher = null;
    }
}
/**
 * Get all available themes with their names.
 * Currently returns a static list; can be extended if package exports API.
 */
export async function getAvailableThemes() {
    // Future: integrate with pi-coding-agent's theme registry when available
    return ['dark', 'light'];
}
/**
 * Get theme by name.
 */
export function getThemeByName(name) {
    try {
        const pkg = require('@earendil-works/pi-coding-agent');
        if (pkg.getThemeByName) {
            return pkg.getThemeByName(name);
        }
        if (pkg.default?.getThemeByName) {
            return pkg.default.getThemeByName(name);
        }
    }
    catch {
        // ignore
    }
    return undefined;
}
/**
 * Set a theme (returns result indicating success/error).
 */
export function setTheme(name, silent = false) {
    try {
        initTheme(name, silent);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error?.message ?? 'Unknown error' };
    }
}
/**
 * Set theme instance directly.
 */
export function setThemeInstance(themeObj) {
    currentTheme = themeObj;
}
//# sourceMappingURL=theme.js.map