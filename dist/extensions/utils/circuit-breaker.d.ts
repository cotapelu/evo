#!/usr/bin/env node
/**
 * Circuit Breaker Utility
 *
 * Implements the circuit breaker pattern for network-dependent operations.
 * Prevents repeated calls to failing services and allows recovery after a timeout.
 *
 * States: CLOSED (normal), OPEN (failing fast), HALF_OPEN (testing).
 *
 * Usage:
 *   const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 30000 });
 *   const result = await cb.execute(() => someNetworkCall());
 *
 * Registry:
 *   registerCircuit('name', cb);
 *   getCircuit('name');
 *   listCircuits();
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export interface CircuitBreakerOptions {
    failureThreshold?: number;
    resetTimeout?: number;
}
export declare class CircuitBreaker {
    private state;
    private failures;
    private openSince;
    private readonly failureThreshold;
    private readonly resetTimeout;
    constructor(options?: CircuitBreakerOptions);
    execute<T>(fn: () => Promise<T>): Promise<T>;
    private openCircuit;
    getState(): CircuitState;
    getFailureCount(): number;
    reset(): void;
}
export declare function registerCircuit(name: string, circuit: CircuitBreaker): void;
export declare function getCircuit(name: string): CircuitBreaker | undefined;
export declare function listCircuits(): Array<{
    name: string;
    state: CircuitState;
    failures: number;
}>;
//# sourceMappingURL=circuit-breaker.d.ts.map