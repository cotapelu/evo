import { AgentConfig, BASE_AGENT_CONFIG } from './base.js';
import { researcherAgent } from './researcher.js';
import { coderAgent } from './coder.js';
import { analyzerAgent } from './analyzer.js';

export {
  AgentConfig,
  BASE_AGENT_CONFIG,
  researcherAgent,
  coderAgent,
  analyzerAgent,
};

export const ALL_AGENTS = {
  researcher: researcherAgent,
  coder: coderAgent,
  analyzer: analyzerAgent,
} as const;

export type AgentType = keyof typeof ALL_AGENTS;
