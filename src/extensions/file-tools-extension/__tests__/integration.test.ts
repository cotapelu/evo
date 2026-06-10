#!/usr/bin/env node
/**
 * File Tools Extension – Integration Tests
 */

import { jest } from '@jest/globals';
import registerFileToolsExtension from '../index.js';
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";

function createMockApi(): any {
	const api: any = {
		registerTool: jest.fn(),
		registerCommand: jest.fn(), // Add this
		on: jest.fn(),
		ui: { setHeader: jest.fn(), setFooter: jest.fn() },
	};
	return api;
}

describe('File Tools Extension', () => {
	let api: any;

	beforeEach(() => {
		api = createMockApi();
	});

	it('registers without throwing', () => {
		expect(() => registerFileToolsExtension(api)).not.toThrow();
	});

	it('registers multiple tools (at least 7)', () => {
		registerFileToolsExtension(api);
		const count = api.registerTool.mock.calls.length;
		expect(count).toBeGreaterThanOrEqual(7);
	});

	it('includes core file tools: read, ls, grep, find, edit, write, bash', () => {
		registerFileToolsExtension(api);
		const toolNames: string[] = api.registerTool.mock.calls.map((call: any[]) => {
			const tool: ToolDefinition = call[0];
			return tool.name;
		});
		expect(toolNames.some(n => n === 'read' || n === 'cat' || n === 'read_file')).toBe(true);
		expect(toolNames.includes('ls')).toBe(true);
		expect(toolNames.includes('grep')).toBe(true);
		expect(toolNames.includes('find')).toBe(true);
		expect(toolNames.includes('edit')).toBe(true);
		expect(toolNames.includes('write')).toBe(true);
		expect(toolNames.includes('bash')).toBe(true);
	});

	it('enhances tools with cwd parameter', () => {
		registerFileToolsExtension(api);
		// Check a few tools for cwd property
		const readTool: ToolDefinition = api.registerTool.mock.calls[0][0];
		expect(readTool.parameters).toHaveProperty('properties.cwd');
		expect((readTool.parameters as any).properties.cwd.type).toBe('string');
	});
});
