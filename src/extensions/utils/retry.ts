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
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
	const { maxAttempts = 3, baseDelay = 1000, maxDelay = 30000 } = options;
	let lastError: any;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (e) {
			lastError = e;
			if (attempt === maxAttempts) break;
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
export async function execWithRetry(
	execFn: (command: string, args: string[], options?: any) => Promise<any>,
	command: string,
	args: string[],
	options?: any,
	retryOptions?: RetryOptions
): Promise<any> {
	return retry(() => execFn(command, args, options), retryOptions);
}
