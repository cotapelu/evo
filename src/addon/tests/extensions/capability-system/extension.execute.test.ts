import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock registry and related modules BEFORE importing extension
let mockCapabilities: any[] = [];

vi.mock('../../../extensions/capability-system/registry.ts', () => {
  const registry = {
    has: vi.fn((id) => mockCapabilities.some(c => c.id === id)),
    register: vi.fn((cap: any) => { mockCapabilities.push(cap); }),
    listAll: vi.fn(() => mockCapabilities),
    get: vi.fn((id) => mockCapabilities.find(c => c.id === id)),
    clear: vi.fn(() => { mockCapabilities.length = 0; }),
  };
  return { getCapabilityRegistry: vi.fn(() => registry) };
});

vi.mock('./prompt-integration.js', () => ({
  createCapabilityDiscoveryCapability: vi.fn(() => ({ id: 'system.capabilities' }))
}));

import capabilitySystemExtension from '../../../extensions/capability-system/extension.ts';
import { getCapabilityRegistry } from '../../../extensions/capability-system/registry.ts';

describe('Capability Router Tool execute() branches', () => {
  let mockApi: any;
  let mockCtx: any;
  let tool: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCapabilities = []; // reset
    const registry = getCapabilityRegistry();
    registry.clear();
    // Pre-register a test capability
    registry.register({
      id: 'test.capability',
      name: 'Test Capability',
      description: 'A test capability',
      execute: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'OK' }] })
    });
    // Register discovery capability as the extension would
    registry.register({ id: 'system.capabilities', name: 'Capabilities', description: 'List capabilities', execute: vi.fn() });

    mockApi = {
      registerTool: vi.fn(),
      registerCommand: vi.fn(),
      exec: vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' })
    };
    mockCtx = {
      cwd: process.cwd(),
      signal: undefined,
      onUpdate: vi.fn(),
    };

    await capabilitySystemExtension(mockApi);
    tool = mockApi.registerTool.mock.calls[0][0];
  });

  it('should create and register the capability router tool', () => {
    expect(mockApi.registerTool).toHaveBeenCalled();
    expect(tool.name).toBe('capability');
    expect(tool.parameters).toBeDefined();
  });

  it('execute: missing capability param returns error', async () => {
    const result = await tool.execute('call-id', {}, mockCtx.signal, mockCtx.onUpdate, mockCtx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Missing 'capability'");
  });

  it('execute: capability not found returns suggestions', async () => {
    const result = await tool.execute('call-id', { capability: 'unknown.capability' }, mockCtx.signal, mockCtx.onUpdate, mockCtx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('❌ Not found');
  });

  it('execute: successful capability execution returns result', async () => {
    const result = await tool.execute('call-id', { capability: 'test.capability', params: {} }, mockCtx.signal, mockCtx.onUpdate, mockCtx);
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toBe('OK');
    // details should include capabilityId
    if (result.details) {
      expect(result.details.capabilityId).toBe('test.capability');
    }
  });
});
