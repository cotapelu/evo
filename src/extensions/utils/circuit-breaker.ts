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
  failureThreshold?: number; // consecutive failures to open circuit (default: 3)
  resetTimeout?: number;     // ms to wait before half-open (default: 30000)
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures: number = 0;
  private openSince: number | null = null;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetTimeout = options.resetTimeout ?? 30000;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // If circuit is OPEN, check timeout
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - (this.openSince as number);
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
    } catch (err) {
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

  private openCircuit(): void {
    this.state = 'OPEN';
    this.openSince = Date.now();
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failures;
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.openSince = null;
  }
}

// ============================================================================
// Registry for shared access
// ============================================================================
const registry = new Map<string, CircuitBreaker>();

export function registerCircuit(name: string, circuit: CircuitBreaker): void {
  registry.set(name, circuit);
}

export function getCircuit(name: string): CircuitBreaker | undefined {
  return registry.get(name);
}

export function listCircuits(): Array<{ name: string; state: CircuitState; failures: number }> {
  return Array.from(registry.entries()).map(([name, cb]) => ({
    name,
    state: cb.getState(),
    failures: cb.getFailureCount(),
  }));
}
