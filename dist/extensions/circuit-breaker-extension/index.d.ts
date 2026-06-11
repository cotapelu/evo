#!/usr/bin/env node
/**
 * Circuit Breaker Extension
 *
 * Provides tools and commands to monitor and control circuit breakers.
 * - Tool: system.circuits – list all circuit breakers and their state
 * - Command: /system.circuit.reset <name> – reset a circuit to CLOSED
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export declare function registerCircuitBreakerExtension(api: ExtensionAPI): void;
export default registerCircuitBreakerExtension;
//# sourceMappingURL=index.d.ts.map