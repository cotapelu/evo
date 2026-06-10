#!/usr/bin/env node
/**
 * Super File Tools Extension – Full SDK Power
 *
 * Uses SDK tool factories with advanced options:
 * - All file tools with cwd override support
 * - Dynamic tool enable/disable via api.setActiveTools
 * - File mutation tracking
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
/**
 * Create all file tools with optional cwd override
 */
export declare function registerEnhancedFileToolsExtension(api: ExtensionAPI): void;
/**
 * Backward compatible export
 */
export declare function registerFileToolsExtension(api: ExtensionAPI): void;
export default registerEnhancedFileToolsExtension;
//# sourceMappingURL=index.d.ts.map