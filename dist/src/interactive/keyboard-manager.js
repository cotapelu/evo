import { matchesKey } from '@earendil-works/pi-tui';
/**
 * Manages global keyboard shortcuts.
 * Uses pi-tui's matchesKey for key identification.
 */
export class KeyboardManager {
    handlers = new Map();
    constructor() {
        // No UI needed; pure key→handler registry
    }
    /**
     * Register a handler for a specific key ID.
     * keyId can be any string that matchesKey understands.
     */
    register(keyId, handler) {
        this.handlers.set(keyId, handler);
    }
    /**
     * Handle a key press event.
     * Returns { consume: true } if the event was handled.
     */
    handle(data) {
        for (const [keyId, handler] of this.handlers) {
            // matchesKey accepts arbitrary key strings; cast to any to bypass strict type
            if (matchesKey(data, keyId)) {
                return handler(data);
            }
        }
        return undefined;
    }
    /**
     * Clear all registered handlers (useful for cleanup).
     */
    clear() {
        this.handlers.clear();
    }
}
//# sourceMappingURL=keyboard-manager.js.map