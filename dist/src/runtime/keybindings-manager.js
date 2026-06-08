/**
 * KeybindingsManager for Evo Agent
 * Manages keybinding registration and matching for app and extension shortcuts.
 */
import { TUI_KEYBINDINGS, matchesKey } from '@earendil-works/pi-tui';
export class KeybindingsManager {
    keysById = new Map();
    extensionShortcuts = new Map();
    constructor() {
        // Initialize with TUI keybindings (editor navigation, etc.)
        for (const [id, def] of Object.entries(TUI_KEYBINDINGS)) {
            const keys = Array.isArray(def.defaultKeys) ? def.defaultKeys : [def.defaultKeys];
            this.keysById.set(id, keys);
        }
        // Add app-specific keybindings
        const appKeybindings = {
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
     * Check if input data matches a keybinding (app or extension)
     */
    matches(data, keybinding) {
        const keys = this.keysById.get(keybinding) || [];
        for (const key of keys) {
            if (matchesKey(data, key))
                return true;
        }
        return false;
    }
    /**
     * Get the primary key for a binding
     */
    getKey(binding) {
        const keys = this.keysById.get(binding);
        return keys && keys.length > 0 ? keys[0] : '';
    }
    /**
     * Get all keys for a binding
     */
    getKeys(binding) {
        return this.keysById.get(binding) || [];
    }
    /**
     * Get the effective keybinding config (for extension conflict checking)
     * Returns a record of binding ID to its key strings (single or array).
     */
    getEffectiveConfig() {
        const config = {};
        for (const [id, keys] of this.keysById) {
            config[id] = keys.length === 1 ? keys[0] : keys;
        }
        return config;
    }
    /**
     * Register an extension shortcut.
     * @param keybinding - The key combination string (e.g., 'ctrl+e')
     * @param handler - Function to call when shortcut triggered
     */
    registerExtensionShortcut(keybinding, handler) {
        this.keysById.set(`extension:${keybinding}`, [keybinding]);
        this.extensionShortcuts.set(keybinding, { handler });
    }
    /**
     * Get all registered extension shortcuts as a Map.
     * Key: keybinding string, Value: { handler, description?, extensionPath? }
     */
    getExtensionShortcuts() {
        return new Map(this.extensionShortcuts);
    }
    /**
     * Handle a key data event, checking extension shortcuts.
     * Returns result if handled, undefined if not.
     */
    handleExtensionShortcut(data) {
        for (const [key, { handler }] of this.extensionShortcuts) {
            if (matchesKey(data, key)) {
                const result = handler();
                // Cast to allow void returns (treat as undefined)
                return result;
            }
        }
        return undefined;
    }
    /**
     * Create a new instance
     */
    static create() {
        return new KeybindingsManager();
    }
}
//# sourceMappingURL=keybindings-manager.js.map