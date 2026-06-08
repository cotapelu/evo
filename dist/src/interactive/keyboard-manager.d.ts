/**
 * Manages global keyboard shortcuts.
 * Uses pi-tui's matchesKey for key identification.
 */
export declare class KeyboardManager {
    private handlers;
    constructor();
    /**
     * Register a handler for a specific key ID.
     * keyId can be any string that matchesKey understands.
     */
    register(keyId: string, handler: (data: string) => {
        consume?: boolean;
    }): void;
    /**
     * Handle a key press event.
     * Returns { consume: true } if the event was handled.
     */
    handle(data: string): {
        consume?: boolean;
    } | undefined;
    /**
     * Clear all registered handlers (useful for cleanup).
     */
    clear(): void;
}
//# sourceMappingURL=keyboard-manager.d.ts.map