#!/usr/bin/env node
/**
 * Config Manager - Simple wrapper for settings access
 * Minimal implementation for settings-command.ts
 */
export interface ConfigManager {
    get<S extends Record<string, any>>(key: string): S | undefined;
    set(key: string, value: any): void;
    save(): Promise<void>;
}
export declare function createConfigManager(cwd: string): ConfigManager;
export declare function getSettingsPath(cwd: string): string;
//# sourceMappingURL=config-manager.d.ts.map