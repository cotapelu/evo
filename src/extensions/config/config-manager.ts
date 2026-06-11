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

export function createConfigManager(cwd: string): ConfigManager {
  return {
    get(key) { return undefined; },
    set(key, value) {},
    async save() {}
  };
}

export function getSettingsPath(cwd: string): string {
  return `${cwd}/.pi/settings.json`;
}
