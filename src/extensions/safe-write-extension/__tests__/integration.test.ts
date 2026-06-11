#!/usr/bin/env node
/**
 * Safe Write Extension – Integration Tests
 */

import { jest } from '@jest/globals';
import registerSafeWriteExtension from '../index.js';
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

function createMockApi(): any {
	const api: any = {
		registerTool: jest.fn(),
		on: jest.fn(),
		ui: { setHeader: jest.fn(), setFooter: jest.fn() },
	};
	return api;
}

describe('Safe Write Extension', () => {
	let api: any;

	beforeEach(() => {
		api = createMockApi();
	});

	it('registers safe_write tool', () => {
		registerSafeWriteExtension(api);
		expect(api.registerTool).toHaveBeenCalled();
		const tool: ToolDefinition = api.registerTool.mock.calls[0][0];
		expect(tool.name).toBe('safe_write');
	});

	it('tool has required parameters file_path and content', () => {
		registerSafeWriteExtension(api);
		const tool: ToolDefinition = api.registerTool.mock.calls[0][0];
		const props = tool.parameters.properties;
		expect(props).toHaveProperty('file_path');
		expect(props).toHaveProperty('content');
	});

	it('execute writes file within mutation queue', async () => {
		registerSafeWriteExtension(api);
		const tool: ToolDefinition = api.registerTool.mock.calls[0][0];

		const tmp = await mkdir(join(tmpdir(), 'safe-write-test'), { recursive: true });
		const cwd = tmp;
		const ctx = { cwd, exec: () => Promise.resolve({code:0}) };
		const filePath = 'output.txt';
		const content = 'Hello World';

		const result: any = await tool.execute('test', { file_path: filePath, content }, undefined, undefined, ctx);
		expect(result.isError).toBe(false);
		expect(result.content[0].text).toContain('Wrote');
		expect(result.details.path).toContain(filePath);
	});
});
