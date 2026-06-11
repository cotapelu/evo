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
export class CircuitBreaker {
    state = 'CLOSED';
    failures = 0;
    openSince = null;
    failureThreshold;
    resetTimeout;
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold ?? 3;
        this.resetTimeout = options.resetTimeout ?? 30000;
    }
    async execute(fn) {
        // If circuit is OPEN, check timeout
        if (this.state === 'OPEN') {
            const elapsed = Date.now() - this.openSince;
            if (elapsed < this.resetTimeout) {
                throw new Error('Circuit breaker is OPEN (failing fast)');
            }
            // Timeout elapsed; transition to HALF_OPEN to test the waters
            this.state = 'HALF_OPEN';
        }
        try {
            const result = await fn();
            // On success, reset failures and close if HALF_OPEN
            this.failures = 0;
            if (this.state === 'HALF_OPEN') {
                this.state = 'CLOSED';
            }
            return result;
        }
        catch (err) {
            this.failures++;
            // If in HALF_OPEN, any failure reopens immediately
            if (this.state === 'HALF_OPEN') {
                this.openCircuit();
                throw err;
            }
            // In CLOSED, check threshold
            if (this.state === 'CLOSED' && this.failures >= this.failureThreshold) {
                this.openCircuit();
            }
            throw err;
        }
    }
    openCircuit() {
        this.state = 'OPEN';
        this.openSince = Date.now();
    }
    getState() {
        return this.state;
    }
    getFailureCount() {
        return this.failures;
    }
    reset() {
        this.state = 'CLOSED';
        this.failures = 0;
        this.openSince = null;
    }
}
// ============================================================================
// Registry for shared access
// ============================================================================
const registry = new Map();
export function registerCircuit(name, circuit) {
    registry.set(name, circuit);
}
export function getCircuit(name) {
    return registry.get(name);
}
export function listCircuits() {
    return Array.from(registry.entries()).map(([name, cb]) => ({
        name,
        state: cb.getState(),
        failures: cb.getFailureCount(),
    }));
}
//# sourceMappingURL=circuit-breaker.js.map