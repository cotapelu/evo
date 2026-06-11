#!/usr/bin/env node
/**
 * Retry utility for network-dependent operations.
 * Provides exponential backoff with jitter.
 */
export interface RetryOptions {
    /** Maximum number of attempts (default: 3) */
    maxAttempts?: number;
    /** Base delay in ms (default: 1000) */
    baseDelay?: number;
    /** Maximum delay between retries (default: 30000) */
    maxDelay?: number;
}
/**
 * Retry a function that may fail, with exponential backoff.
 * The function should throw on failure.
 */
export declare function retry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
/**
 * Wrap an exec call with retry logic.
 */
export declare function execWithRetry(execFn: (command: string, args: string[], options?: any) => Promise<any>, command: string, args: string[], options?: any, retryOptions?: RetryOptions): Promise<any>;
//# sourceMappingURL=retry.d.ts.map