/**
 * KeybindingsManager for Evo Agent
 * Manages keybinding registration and matching for app and extension shortcuts.
 */
export declare class KeybindingsManager {
    private keysById;
    private extensionShortcuts;
    constructor();
    /**
     * Check if input data matches a keybinding (app or extension)
     */
    matches(data: string, keybinding: string): boolean;
    /**
     * Get the primary key for a binding
     */
    getKey(binding: string): string;
    /**
     * Get all keys for a binding
     */
    getKeys(binding: string): string[];
    /**
     * Get the effective keybinding config (for extension conflict checking)
     * Returns a record of binding ID to its key strings (single or array).
     */
    getEffectiveConfig(): Record<string, string | string[]>;
    /**
     * Register an extension shortcut.
     * @param keybinding - The key combination string (e.g., 'ctrl+e')
     * @param handler - Function to call when shortcut triggered
     */
    registerExtensionShortcut(keybinding: string, handler: () => void | {
        consume?: boolean;
        data?: string;
    }): void;
    /**
     * Get all registered extension shortcuts as a Map.
     * Key: keybinding string, Value: { handler, description?, extensionPath? }
     */
    getExtensionShortcuts(): Map<string, {
        handler: () => void | {
            consume?: boolean;
            data?: string;
        };
    }>;
    /**
     * Handle a key data event, checking extension shortcuts.
     * Returns result if handled, undefined if not.
     */
    handleExtensionShortcut(data: string): {
        consume?: boolean;
        data?: string;
    } | undefined;
    /**
     * Create a new instance
     */
    static create(): KeybindingsManager;
}
//# sourceMappingURL=keybindings-manager.d.ts.map