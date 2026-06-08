/**
 * Tools Manager for Evo Agent
 * Ensures required CLI tools are available, downloads if missing.
 */
type ToolName = 'fd' | 'rg' | 'gh';
/**
 * Get the path to a tool, ensuring it's available.
 * Downloads to bin dir if missing (basic implementation; expand as needed).
 */
export declare function ensureTool(name: ToolName): Promise<string>;
/**
 * Check if a tool is installed (non-throwing).
 */
export declare function checkToolInstalled(name: ToolName): boolean;
/**
 * Get version of a tool (if available).
 */
export declare function getToolVersion(name: ToolName): string | null;
export {};
//# sourceMappingURL=tools-manager.d.ts.map