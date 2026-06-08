/**
 * Clipboard utilities for Evo Agent
 * Handles copying text and reading images from clipboard.
 */
/**
 * Copy text to system clipboard.
 */
export declare function copyToClipboard(text: string): Promise<void>;
/**
 * Read image from clipboard (if available).
 * Returns { bytes: Uint8Array, mimeType: string } or null.
 */
export declare function readClipboardImage(): Promise<{
    bytes: Uint8Array;
    mimeType: string;
} | null>;
/**
 * Get file extension for image MIME type.
 */
export declare function extensionForImageMimeType(mimeType: string): string | null;
//# sourceMappingURL=clipboard.d.ts.map