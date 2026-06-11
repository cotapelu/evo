#!/usr/bin/env node
/**
 * Resource Loader Extension – Project Context Discovery with Safety Limits
 *
 * Automatically adds project documentation to the agent's context.
 * - Scans for common docs: AGENTS.md, README.md, README.*.md, docs/*.md, etc.
 * - Injects these files into the system prompt via `before_agent_start`.
 * - Provides a tool to list loaded resources (both built-in and extra).
 *
 * Does not use `resources_discover` for agentsFiles; uses session_start + before_agent_start.
 *
 * Safety limits to avoid context overflow:
 * - Max 10 files included
 * - Each file limited to 100KB
 * - Files sorted by priority (AGENTS.md > README.md > others)
 */
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
declare function scanDocumentation(cwd: string): Array<{
    path: string;
    content: string;
}>;
export declare function createListResourcesTool(): ToolDefinition<any, any>;
export declare function registerResourceLoaderExtension(api: ExtensionAPI): void;
export { scanDocumentation };
export default registerResourceLoaderExtension;
//# sourceMappingURL=index.d.ts.map