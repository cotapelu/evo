import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMultiAgentTool } from '../../extensions/multi-agent-tool/router.js';

// Mock dependencies with correct relative paths
vi.mock('../../extensions/multi-agent-tool/parent-tools.js', () => ({
  setRuntime: vi.fn(),
  spawnChild: vi.fn(),
  sendMessage: vi.fn(),
  awaitResult: vi.fn(),
  listChildren: vi.fn(),
  terminateChild: vi.fn(),
}));

vi.mock('../../runtime-context.js', () => ({
  getCurrentRuntime: vi.fn(),
}));

vi.mock('../../extensions/multi-agent-tool/runtime.js', () => ({
  multiAgentRuntime: {
    setParentConfig: vi.fn(),
    parentConfig: undefined,
  },
}));

vi.mock('../../extensions/multi-agent-tool/definition.js', () => ({
  MULTI_AGENT_TOOL_DESCRIPTION: 'desc',
  MULTI_AGENT_TOOL_PROMPT_SNIPPET: 'snippet',
  MULTI_AGENT_TOOL_PROMPT_GUIDELINES: [],
  MULTI_AGENT_TOOL_PARAMETERS: { type: 'object', properties: {} },
}));

import { spawnChild, sendMessage, awaitResult, listChildren, terminateChild } from '../../extensions/multi-agent-tool/parent-tools.js';
import { getCurrentRuntime } from '../../runtime-context.js';
import { multiAgentRuntime } from '../../extensions/multi-agent-tool/runtime.js';

describe('MultiAgent Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (multiAgentRuntime as any).parentConfig = undefined;
  });

  it('should create tool definition with metadata', () => {
    const tool = createMultiAgentTool();
    expect(tool.name).toBe('multi-agent');
    expect(tool.label).toBe('Multi-Agent Orchestration');
    expect(tool.description).toBe('desc');
    expect(tool.promptSnippet).toBe('snippet');
    expect(tool.parameters).toEqual({ type: 'object', properties: {} });
  });

  describe('execute operations', () => {
    it('spawn_child requires mission', async () => {
      const tool = createMultiAgentTool();
      const result = await tool.execute('id', { operation: 'spawn_child' });
      expect(result.content[0].text).toContain('mission is required');
    });

    it('spawn_child calls parent-tools.spawnChild', async () => {
      (spawnChild as any).mockResolvedValue({ content: [{ type: 'text', text: 'spawned' }] });
      const tool = createMultiAgentTool();
      const result = await tool.execute('id', {
        operation: 'spawn_child',
        mission: 'test',
        type: 'llm',
        context: { a: 1 },
        tools: ['tool1'],
      });
      expect(spawnChild).toHaveBeenCalledWith({
        type: 'llm',
        mission: 'test',
        context: { a: 1 },
        tools: ['tool1'],
      });
      expect(result.content[0].text).toBe('spawned');
    });

    it('send_message requires childId and message', async () => {
      const tool = createMultiAgentTool();
      let result = await tool.execute('id', { operation: 'send_message' });
      expect(result.content[0].text).toContain('childId is required');

      result = await tool.execute('id', { operation: 'send_message', childId: 'c1' });
      expect(result.content[0].text).toContain('message is required');
    });

    it('send_message calls parent-tools.sendMessage', async () => {
      (sendMessage as any).mockResolvedValue({ content: [{ type: 'text', text: 'sent' }] });
      const tool = createMultiAgentTool();
      const result = await tool.execute('id', {
        operation: 'send_message',
        childId: 'c1',
        message: { type: 'input', payload: 'hi' },
      });
      expect(sendMessage).toHaveBeenCalledWith({
        childId: 'c1',
        message: { type: 'input', payload: 'hi' },
      });
      expect(result.content[0].text).toBe('sent');
    });

    it('await_result requires childId', async () => {
      const tool = createMultiAgentTool();
      const result = await tool.execute('id', { operation: 'await_result' });
      expect(result.content[0].text).toContain('childId is required');
    });

    it('await_result calls parent-tools.awaitResult', async () => {
      (awaitResult as any).mockResolvedValue({ content: [{ type: 'text', text: 'result' }] });
      const tool = createMultiAgentTool();
      const result = await tool.execute('id', {
        operation: 'await_result',
        childId: 'c1',
        timeoutMs: 5000,
      });
      expect(awaitResult).toHaveBeenCalledWith({
        childId: 'c1',
        timeoutMs: 5000,
      });
      expect(result.content[0].text).toBe('result');
    });

    it('list_children returns list', async () => {
      (listChildren as any).mockResolvedValue({ content: [{ type: 'text', text: 'children' }] });
      const tool = createMultiAgentTool();
      const result = await tool.execute('id', { operation: 'list_children', status: 'running' });
      expect(listChildren).toHaveBeenCalledWith({ status: 'running' });
      expect(result.content[0].text).toBe('children');
    });

    it('terminate_child requires childId', async () => {
      const tool = createMultiAgentTool();
      const result = await tool.execute('id', { operation: 'terminate_child' });
      expect(result.content[0].text).toContain('childId is required');
    });

    it('terminate_child calls parent-tools.terminateChild', async () => {
      (terminateChild as any).mockResolvedValue({ content: [{ type: 'text', text: 'terminated' }] });
      const tool = createMultiAgentTool();
      const result = await tool.execute('id', {
        operation: 'terminate_child',
        childId: 'c1',
        force: true,
      });
      expect(terminateChild).toHaveBeenCalledWith({
        childId: 'c1',
        force: true,
      });
      expect(result.content[0].text).toBe('terminated');
    });

    it('unknown operation throws', async () => {
      const tool = createMultiAgentTool();
      const result = await tool.execute('id', { operation: 'unknown' });
      expect(result.content[0].text).toContain('Unknown operation');
    });
  });

  describe('ensureParentConfig', () => {
    it('sets parent config when runtime available', () => {
      const mockRuntime = {
        cwd: '/test',
        agentDir: '/agent',
        services: { s: 1 },
        sessionManager: { sm: 2 },
      };
      (getCurrentRuntime as any).mockReturnValue(mockRuntime);
      const tool = createMultiAgentTool();
      (spawnChild as any).mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
      tool.execute('id', { operation: 'spawn_child', mission: 'test' });
      expect(multiAgentRuntime.setParentConfig).toHaveBeenCalledWith({
        cwd: '/test',
        agentDir: '/agent',
        model: 'anthropic/claude-sonnet-4-20250514',
        thinkingLevel: 'medium',
        tools: [],
        services: { s: 1 },
        sessionManager: { sm: 2 },
      });
    });

    it('does not set parent config if no runtime services', () => {
      (getCurrentRuntime as any).mockReturnValue({ cwd: '/test' });
      const tool = createMultiAgentTool();
      (spawnChild as any).mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
      tool.execute('id', { operation: 'spawn_child', mission: 'test' });
      expect(multiAgentRuntime.setParentConfig).not.toHaveBeenCalled();
    });

    it('handles runtime errors gracefully', () => {
      (getCurrentRuntime as any).mockImplementation(() => {
        throw new Error('fail');
      });
      const tool = createMultiAgentTool();
      (spawnChild as any).mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
      tool.execute('id', { operation: 'spawn_child', mission: 'test' });
      expect(multiAgentRuntime.setParentConfig).not.toHaveBeenCalled();
    });
  });
});
