import { describe, it, expect } from 'vitest';
import {
  MULTI_AGENT_TOOL_DESCRIPTION,
  MULTI_AGENT_TOOL_PROMPT_SNIPPET,
  MULTI_AGENT_TOOL_PROMPT_GUIDELINES,
  MULTI_AGENT_TOOL_PARAMETERS,
  buildMultiAgentToolDefinition
} from '../../extensions/multi-agent-tool/definition.js';

describe('Multi-Agent Tool Definition', () => {
  it('exports all expected constants', () => {
    expect(typeof MULTI_AGENT_TOOL_DESCRIPTION).toBe('string');
    expect(typeof MULTI_AGENT_TOOL_PROMPT_SNIPPET).toBe('string');
    expect(Array.isArray(MULTI_AGENT_TOOL_PROMPT_GUIDELINES)).toBe(true);
    expect(typeof MULTI_AGENT_TOOL_PARAMETERS).toBe('object');
  });

  it('MULTI_AGENT_TOOL_PROMPT_GUIDELINES is non-empty', () => {
    expect(MULTI_AGENT_TOOL_PROMPT_GUIDELINES.length).toBeGreaterThan(0);
  });

  it('buildMultiAgentToolDefinition returns correct tool structure', () => {
    const def = buildMultiAgentToolDefinition();
    expect(def).toEqual({
      name: 'multi-agent',
      label: 'Multi-Agent Orchestration',
      description: MULTI_AGENT_TOOL_DESCRIPTION,
      promptSnippet: MULTI_AGENT_TOOL_PROMPT_SNIPPET,
      promptGuidelines: MULTI_AGENT_TOOL_PROMPT_GUIDELINES,
      parameters: MULTI_AGENT_TOOL_PARAMETERS,
    });
  });

  it('description contains key phrases', () => {
    expect(MULTI_AGENT_TOOL_DESCRIPTION).toContain('Spawn and manage');
    expect(MULTI_AGENT_TOOL_DESCRIPTION).toContain('parallel');
  });

  it('prompt snippet outlines operations', () => {
    expect(MULTI_AGENT_TOOL_PROMPT_SNIPPET).toContain('spawn_child');
    expect(MULTI_AGENT_TOOL_PROMPT_SNIPPET).toContain('send_message');
    expect(MULTI_AGENT_TOOL_PROMPT_SNIPPET).toContain('await_result');
    expect(MULTI_AGENT_TOOL_PROMPT_SNIPPET).toContain('list_children');
    expect(MULTI_AGENT_TOOL_PROMPT_SNIPPET).toContain('terminate_child');
  });

  it('parameters includes required operation enum', () => {
    const opParam = MULTI_AGENT_TOOL_PARAMETERS.properties.operation;
    expect(opParam.type).toBe('string');
    expect(opParam.enum).toContain('spawn_child');
    expect(opParam.enum).toContain('send_message');
    expect(opParam.enum).toContain('await_result');
    expect(opParam.enum).toContain('list_children');
    expect(opParam.enum).toContain('terminate_child');
  });

  it('parameters defines other operation fields', () => {
    const props = MULTI_AGENT_TOOL_PARAMETERS.properties;
    expect(props.type).toBeDefined();
    expect(props.mission).toBeDefined();
    expect(props.context).toBeDefined();
    expect(props.childId).toBeDefined();
    expect(props.message).toBeDefined();
  });
});
