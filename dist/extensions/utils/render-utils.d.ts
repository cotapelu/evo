#!/usr/bin/env node
/**
 * Render Utils
 * Styling utilities for custom renderers
 */
/**
 * Style error text
 * Accepts theme for compatibility, falls back to chalk.red
 */
export declare function styleError(themeOrText: any, text?: string): string;
/**
 * Style success text
 */
export declare function styleSuccess(themeOrText: any, text?: string): string;
/**
 * Style warning text
 */
export declare function styleWarning(themeOrText: any, text?: string): string;
/**
 * Style normal text
 */
export declare function styleText(themeOrText: any, text?: string): string;
/**
 * Truncate text with ellipsis
 */
export declare function truncate(text: string, maxLength: number): string;
/**
 * Pad text to width
 */
export declare function pad(text: string, width: number): string;
//# sourceMappingURL=render-utils.d.ts.map