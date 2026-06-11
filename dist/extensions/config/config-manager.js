#!/usr/bin/env node
/**
 * Config Manager - Simple wrapper for settings access
 * Minimal implementation for settings-command.ts
 */
export function createConfigManager(cwd) {
    return {
        get(key) { return undefined; },
        set(key, value) { },
        async save() { }
    };
}
export function getSettingsPath(cwd) {
    return `${cwd}/.pi/settings.json`;
}
//# sourceMappingURL=config-manager.js.map