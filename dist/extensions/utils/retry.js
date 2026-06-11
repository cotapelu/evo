#!/usr/bin/env node
/**
 * Retry utility for network-dependent operations.
 * Provides exponential backoff with jitter.
 */
/**
 * Retry a function that may fail, with exponential backoff.
 * The function should throw on failure.
 */
export async function retry(fn, options = {}) {
    const { maxAttempts = 3, baseDelay = 1000, maxDelay = 30000 } = options;
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (e) {
            lastError = e;
            if (attempt === maxAttempts)
                break;
            // Exponential backoff with jitter
            const delay = Math.min(baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000, maxDelay);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}
/**
 * Wrap an exec call with retry logic.
 */
export async function execWithRetry(execFn, command, args, options, retryOptions) {
    return retry(() => execFn(command, args, options), retryOptions);
}
//# sourceMappingURL=retry.js.map