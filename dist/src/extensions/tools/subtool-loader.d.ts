#!/usr/bin/env node
/**
 * SubTool Loader
 * Dispatches to typed sub-tools (computer-use + http).
 *
 * Philosophy: Minimal tools over bash.
 * - computer-use: ls, find, grep, read
 * - http: Web requests
 */
import { ToolDefinition } from "@earendil-works/pi-coding-agent";
/**
 * Create the subtool_loader tool definition
 */
export declare function createSubLoaderToolDefinition(): ToolDefinition;
/**
 * Register the subtool_loader tool with the extension API
 */
export declare function registerSubToolLoaderExtension(api: import("@earendil-works/pi-coding-agent").ExtensionAPI): void;
//# sourceMappingURL=subtool-loader.d.ts.map