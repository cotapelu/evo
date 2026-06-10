#!/usr/bin/env node
/**
 * Safe Write Extension – Demonstrates withFileMutationQueue
 *
 * Provides a `safe_write` tool that atomically writes files using
 * the mutation queue to avoid race conditions and enable debouncing.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export declare function registerSafeWriteExtension(api: ExtensionAPI): void;
export default registerSafeWriteExtension;
//# sourceMappingURL=index.d.ts.map