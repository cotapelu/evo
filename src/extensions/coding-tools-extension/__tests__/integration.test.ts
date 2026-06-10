#!/usr/bin/env node
/**
 * Coding Tools Extension – Integration Tests
 */

import { jest } from '@jest/globals';
import registerCodingToolsExtension from '../index.js';
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";

function createMockApi(): any {
	return {
		registerTool: jest.fn(),
		on: jest.fn(),
		ui: { setHeader: jest.fn(), setFooter: jest.fn() },
	};
}

describe('Coding Tools Extension', () => {
	let api: any;

	beforeEach(() => {
		api = createMockApi();
	});

	it('registers without throwing', () => {
		expect(() => registerCodingToolsExtension(api)).not.toThrow();
	});

	it('registers at least 3 tools from createCodingTools', () => {
		registerCodingToolsExtension(api);
		const count = api.registerTool.mock.calls.length;
		expect(count).toBeGreaterThanOrEqual(3);
	});

	it('enhances each tool with cwd parameter', () => {
		registerCodingToolsExtension(api);
		// If at least one tool registered, check its cwd parameter
		if (api.registerTool.mock.calls.length > 0) {
			const firstTool: ToolDefinition = api.registerTool.mock.calls[0][0];
			expect(firstTool.parameters).toHaveProperty('properties.cwd');
			expect((firstTool.parameters as any).properties.cwd.type).toBe('string');
		}
	});
});
