#!/usr/bin/env node
/**
 * Circuit Breaker Extension
 *
 * Provides tools and commands to monitor and control circuit breakers.
 * - Tool: system.circuits – list all circuit breakers and their state
 * - Command: /system.circuit.reset <name> – reset a circuit to CLOSED
 */

import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { listCircuits, getCircuit, CircuitBreaker } from "../utils/circuit-breaker";

function createCircuitsListTool(): ToolDefinition<any, any> {
	return {
		name: 'system.circuits',
		label: 'System: Circuits',
		description: 'List all circuit breakers and their current status',
		parameters: {},
		async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
			const circuits = listCircuits();
			if (circuits.length === 0) {
				return {
					content: [{ type: 'text', text: 'No circuit breakers registered.' }],
					details: { count: 0 },
				};
			}
			const lines = circuits.map(c => `${c.name}: ${c.state} (failures: ${c.failures})`);
			return {
				content: [{ type: 'text', text: `Circuit Breakers (${circuits.length}):\n${lines.join('\n')}` }],
				details: { count: circuits.length, circuits },
			};
		},
	};
}

export function registerCircuitBreakerExtension(api: ExtensionAPI): void {
	api.registerTool(createCircuitsListTool());

	api.registerCommand('system.circuit.reset', {
		description: 'Reset a circuit breaker by name (e.g., git, package-manager)',
		handler: async (args: string, ctx: any) => {
			const name = args.trim();
			if (!name) {
				ctx.ui.notify?.('Usage: /system.circuit.reset <name>', 'warning');
				return;
			}
			const cb = getCircuit(name);
			if (!cb) {
				ctx.ui.notify?.(`Circuit "${name}" not found`, 'warning');
				return;
			}
			cb.reset();
			ctx.ui.notify?.(`Circuit "${name}" reset to CLOSED`, 'success');
		},
	});

	api.sendMessage?.({
		customType: "circuit-breaker",
		content: "⚡ Circuit Breaker extension loaded – monitor & control for network reliability",
		display: false,
	});
}

export default registerCircuitBreakerExtension;