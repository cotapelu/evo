/**
 * Base agent configuration for specialized agents
 */

export interface AgentConfig {
  type: string;
  systemPrompt: string;
  model?: string;
  thinkingLevel?: 'low' | 'medium' | 'high';
  tools: string[];
  customTools?: any[];
  task?: string;
}

export const BASE_AGENT_CONFIG: AgentConfig = {
  type: 'base',
  systemPrompt: 'You are a helpful AI agent.',
  model: 'anthropic/claude-sonnet-4-20250514',
  thinkingLevel: 'medium',
  tools: ['read', 'write', 'edit', 'bash', 'grep', 'find', 'ls'],
};
