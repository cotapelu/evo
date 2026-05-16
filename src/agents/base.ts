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
  thinkingLevel: 'medium',
  tools: ['read', 'write', 'edit', 'bash', 'grep', 'find', 'ls'],
  // model is set dynamically from defaultModel in agent-manager.ts
};
