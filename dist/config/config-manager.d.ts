#!/usr/bin/env node
export declare const CONFIG_DIR_NAME = ".evo";
/**
 * Get the agent config directory (~/.evo/agent)
 */
export declare function getAgentDir(): string;
/**
 * Get path to managed binaries directory
 */
export declare function getBinDir(): string;
export interface EvoConfig {
    /** Default model to use (e.g., "anthropic:claude-opus-4-5") */
    model?: string;
    /** Default thinking level */
    thinking?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
    /** Default tool allowlist. If not set, all tools are available. */
    tools?: string[];
    /** Custom session directory */
    sessionDir?: string;
    /** Whether to show verbose logs */
    verbose?: boolean;
    /** Custom keybindings: map command name (e.g., "team", "settings") to key string (e.g., "t", "ctrl+s") */
    keybindings?: Record<string, string>;
}
/**
 * Load configuration from disk.
 * Returns merged config: defaults < file < CLI overrides
 */
export declare function loadConfig(cliOverrides?: Partial<EvoConfig>): EvoConfig;
/**
 * Save configuration to disk (with file mutation queue for concurrency safety).
 */
export declare function saveConfig(config: EvoConfig): Promise<void>;
/**
 * Get the config file path (for display/debugging)
 */
export declare function getConfigPath(): string;
//# sourceMappingURL=config-manager.d.ts.map