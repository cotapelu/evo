#!/usr/bin/env node
/**
 * Simple Logger for Extensions
 *
 * Lightweight wrapper around console.log/error/warn.
 * Avoids dependency on external logging library.
 */
/**
 * Create a logger instance.
 * Can prefix messages with a tag for easier filtering.
 */
export function createLogger(tag) {
    const prefix = tag ? `[${tag}]` : '';
    return {
        log: (...args) => {
            if (prefix)
                console.log(prefix, ...args);
            else
                console.log(...args);
        },
        error: (...args) => {
            if (prefix)
                console.error(prefix, ...args);
            else
                console.error(...args);
        },
        warn: (...args) => {
            if (prefix)
                console.warn(prefix, ...args);
            else
                console.warn(...args);
        },
        info: (...args) => {
            if (prefix)
                console.info(prefix, ...args);
            else
                console.info(...args);
        },
        debug: (...args) => {
            if (prefix)
                console.debug(prefix, ...args);
            else
                console.debug(...args);
        },
    };
}
// Default logger without prefix
export const logger = createLogger();
//# sourceMappingURL=logger.js.map