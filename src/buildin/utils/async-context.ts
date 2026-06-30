import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * AsyncLocalStorage for correlation ID propagation across async operations.
 * Provides a way to attach a unique identifier to a request/session and access it from any async context.
 */
const correlationIdStorage = new AsyncLocalStorage<string | undefined>();

/**
 * Get the current correlation ID from async context, if available.
 * Returns undefined if no correlation ID is set in the current execution context.
 */
export function getCorrelationId(): string | undefined {
  return correlationIdStorage.getStore();
}

/**
 * Run a function within a correlation ID context.
 * The correlation ID will be available via getCorrelationId() throughout the execution
 * of fn and any async operations spawned from it.
 *
 * @param correlationId - The correlation ID to associate with this context
 * @param fn - Function to execute within the context
 * @returns The result of fn
 */
export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return correlationIdStorage.run(correlationId, fn);
}
