#!/usr/bin/env node
/**
 * Simple Logger for Extensions
 *
 * Lightweight wrapper around console.log/error/warn.
 * Avoids dependency on external logging library.
 */
interface Logger {
    log: (...args: any[]) => void;
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    info: (...args: any[]) => void;
    debug: (...args: any[]) => void;
}
/**
 * Create a logger instance.
 * Can prefix messages with a tag for easier filtering.
 */
export declare function createLogger(tag?: string): Logger;
export declare const logger: Logger;
export {};
//# sourceMappingURL=logger.d.ts.map