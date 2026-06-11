#!/usr/bin/env node
/**
 * Resource Loader Extension – Project Context Discovery with Caching
 *
 * Automatically adds project documentation to the agent's context.
 * - Hooks into `resources_discover` event
 * - Scans for common docs: AGENTS.md, README.md, README.*.md, docs/*.md, etc.
 * - Caches scan results for 30 seconds to avoid repeated filesystem scans
 * - Merges discovered files into the resource loader
 *
 * Provides tools to inspect loaded resources.
 */
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
export declare function createListResourcesTool(): ToolDefinition<any, any>;
export declare function registerResourceLoaderExtension(api: ExtensionAPI): void;
export default registerResourceLoaderExtension;
//# sourceMappingURL=index.d.ts.map