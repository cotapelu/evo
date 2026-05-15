/**
 * Prompt & Tool Optimization using Genetic Algorithms
 * Evolves system prompts and tool configurations to maximize evolution effectiveness
 */

import type { AgentConfig } from './agents/base.js';

// Extend AgentConfig with optional optimization parameters
interface OptimizedAgentConfig extends AgentConfig {
  temperature?: number;
  maxTokens?: number;
}
import { Logger } from './logger.js';

export interface PromptGenome {
  // System prompt segments (can be combined)
  basePrompt: string;
  contextTemplate: string;
  instructionStyle: 'concise' | 'detailed' | 'step-by-step';
  tone: 'professional' | 'collaborative' | 'direct';

  // Tool configuration
  toolSelection: string[];           // Which tools to include
  toolParams: Record<string, any>;   // Tool-specific parameters

  // Evolution-specific tweaks
  thinkingLevel: 'low' | 'medium' | 'high';
  temperature: number;               // 0-1
  maxTokens: number;
}

export interface OptimizationResult {
  generation: number;
  bestFitness: number;
  bestGenome: PromptGenome;
  improvement: number;
}

export class PromptOptimizer {
  private logger: Logger;
  private populationSize: number;
  private mutationRate: number;
  private generations: number;
  private metrics: any; // EvolutionMetrics

  // Agent types we optimize
  private agentTypes: ('researcher' | 'coder' | 'analyzer')[] = ['researcher', 'coder', 'analyzer'];

  constructor(logger: Logger, metrics: any, options: { populationSize?: number; generations?: number; mutationRate?: number } = {}) {
    this.logger = logger;
    this.populationSize = options.populationSize || 10;
    this.generations = options.generations || 3;
    this.mutationRate = options.mutationRate || 0.1;
    this.metrics = metrics;
  }

  /**
   * Evolve prompts for a specific agent type
   */
  async evolvePrompts(agentType: 'researcher' | 'coder' | 'analyzer', currentConfig: AgentConfig): Promise<OptimizationResult> {
    this.logger.info(`🧬 Starting prompt evolution for ${agentType}`);

    // Initialize population
    let population = this.initializePopulation(currentConfig);

    let bestGenome = population[0];
    let bestFitness = -Infinity;

    for (let gen = 0; gen < this.generations; gen++) {
      // Evaluate fitness for each genome
      const fitnesses = await Promise.all(population.map(genome => this.evaluateFitness(genome, agentType)));

      // Track best
      for (let i = 0; i < population.length; i++) {
        if (fitnesses[i] > bestFitness) {
          bestFitness = fitnesses[i];
          bestGenome = population[i];
        }
      }

      this.logger.debug(`Generation ${gen + 1}/${this.generations}: best fitness = ${bestFitness.toFixed(3)}`);

      // Selection (tournament)
      const newPopulation: PromptGenome[] = [];

      // Elitism: keep top 2
      const sorted = population.map((g, i) => ({ genome: g, fitness: fitnesses[i] }))
        .sort((a, b) => b.fitness - a.fitness);
      newPopulation.push(...sorted.slice(0, 2).map(s => s.genome));

      // Breed rest
      while (newPopulation.length < this.populationSize) {
        const parent1 = this.tournamentSelect(population, fitnesses);
        const parent2 = this.tournamentSelect(population, fitnesses);
        const child = this.crossover(parent1, parent2);
        this.mutate(child);
        newPopulation.push(child);
      }

      population = newPopulation;
    }

    const result: OptimizationResult = {
      generation: this.generations,
      bestFitness,
      bestGenome: bestGenome,
      improvement: (bestFitness / (this.metrics.successRate || 1)) - 1,
    };

    this.logger.info(`✅ Prompt evolution complete for ${agentType}: fitness=${bestFitness.toFixed(3)}`);
    return result;
  }

  /**
   * Create initial population from current config
   */
  private initializePopulation(currentConfig: AgentConfig): PromptGenome[] {
    const population: PromptGenome[] = [];

    // Original (current config)
    population.push({
      basePrompt: this.extractBasePrompt(currentConfig.systemPrompt),
      contextTemplate: this.extractContextTemplate(currentConfig.systemPrompt),
      instructionStyle: 'detailed',
      tone: 'professional',
      toolSelection: currentConfig.tools || [],
      toolParams: {},
      thinkingLevel: currentConfig.thinkingLevel || 'medium',
      temperature: 0.7,
      maxTokens: 4096,
    });

    // Generate variations
    for (let i = 0; i < this.populationSize - 1; i++) {
      const genome = this.mutateGenome(population[0], 0.5); // High mutation for diversity
      population.push(genome);
    }

    return population;
  }

  /**
   * Evaluate how good a prompt configuration is
   */
  private async evaluateFitness(genome: PromptGenome, agentType: string): Promise<number> {
    // Build system prompt
    const systemPrompt = this.buildPrompt(genome);

    // Simulate small batch of improvements (would ideally run actual analysis)
    // For now, use heuristics based on prompt characteristics
    let score = 0;

    // Positive factors
    score += this.analyzePromptQuality(systemPrompt);
    score += (genome.toolSelection.length >= 4 ? 2 : 0); // More tools = more capability
    score += (genome.thinkingLevel === 'high' ? 1.5 : genome.thinkingLevel === 'medium' ? 1.0 : 0.5);
    score += (1.0 - Math.abs(genome.temperature - 0.7)); // Optimal around 0.7

    // Context length penalty/bonus
    const promptLength = systemPrompt.length;
    if (promptLength > 2000) score -= 0.5;
    if (promptLength > 5000) score -= 1.0;
    score += (promptLength > 500 ? 0.5 : 0); // Not too short

    // Add some randomness to simulate LLM variation
    score += (Math.random() * 0.3);

    return score;
  }

  private analyzePromptQuality(prompt: string): number {
    let score = 0;

    // Check for key elements
    if (prompt.includes('improve') || prompt.includes('enhance')) score += 1;
    if (prompt.includes('code quality')) score += 1;
    if (prompt.includes('security')) score += 0.5;
    if (prompt.includes('performance')) score += 0.5;
    if (prompt.includes('test')) score += 0.5;
    if (prompt.includes('documentation')) score += 0.5;

    // Penalize vague prompts
    if (prompt.length < 100) score -= 1;

    return score;
  }

  private buildPrompt(genome: PromptGenome): string {
    const parts: string[] = [];

    // Base instruction
    parts.push(genome.basePrompt);

    // Context template with placeholders
    if (genome.contextTemplate) {
      parts.push(genome.contextTemplate.replace('{timeOfDay}', 'daytime'));
    }

    // Tone modifier
    if (genome.tone === 'collaborative') {
      parts.push("Work collaboratively with the codebase to implement improvements.");
    } else if (genome.tone === 'direct') {
      parts.push("Make direct, concrete changes without excessive explanation.");
    }

    // Instruction style
    if (genome.instructionStyle === 'step-by-step') {
      parts.push("Provide step-by-step analysis and implementation plan.");
    } else if (genome.instructionStyle === 'concise') {
      parts.push("Be concise and to the point.");
    }

    return parts.join('\n\n');
  }

  private extractBasePrompt(prompt: string): string {
    // Simple extraction - in reality would parse better
    const firstParagraph = prompt.split('\n\n')[0];
    return firstParagraph.substring(0, 500);
  }

  private extractContextTemplate(prompt: string): string {
    // Look for template patterns
    if (prompt.includes('{timeOfDay}')) return "Consider it is {timeOfDay}.";
    return "Analyze the current state and suggest improvements.";
  }

  private tournamentSelect(population: PromptGenome[], fitnesses: number[], tournamentSize: number = 3): PromptGenome {
    let best: PromptGenome | null = null;
    let bestFit = -Infinity;

    for (let i = 0; i < tournamentSize; i++) {
      const idx = Math.floor(Math.random() * population.length);
      if (fitnesses[idx] > bestFit) {
        bestFit = fitnesses[idx];
        best = population[idx];
      }
    }

    return best || population[0];
  }

  private crossover(a: PromptGenome, b: PromptGenome): PromptGenome {
    // Single-point crossover on toolSelection
    const crossoverPoint = Math.floor(Math.random() * Math.min(a.toolSelection.length, b.toolSelection.length));
    const childTools = [...a.toolSelection.slice(0, crossoverPoint), ...b.toolSelection.slice(crossoverPoint)];

    // For string fields, pick one parent
    const useAForBase = Math.random() < 0.5;

    return {
      basePrompt: useAForBase ? a.basePrompt : b.basePrompt,
      contextTemplate: useAForBase ? a.contextTemplate : b.contextTemplate,
      instructionStyle: Math.random() < 0.5 ? a.instructionStyle : b.instructionStyle,
      tone: Math.random() < 0.5 ? a.tone : b.tone,
      toolSelection: childTools,
      toolParams: { ...a.toolParams },
      thinkingLevel: useAForBase ? a.thinkingLevel : b.thinkingLevel,
      temperature: (a.temperature + b.temperature) / 2,
      maxTokens: Math.max(a.maxTokens, b.maxTokens),
    };
  }

  private mutate(genome: PromptGenome, rate?: number): void {
    const mutationRate = rate !== undefined ? rate : this.mutationRate;

    // Mutate instruction style
    if (Math.random() < mutationRate) {
      const styles: Array<'concise' | 'detailed' | 'step-by-step'> = ['concise', 'detailed', 'step-by-step'];
      genome.instructionStyle = styles[Math.floor(Math.random() * styles.length)];
    }

    // Mutate tone
    if (Math.random() < mutationRate) {
      const tones: Array<'professional' | 'collaborative' | 'direct'> = ['professional', 'collaborative', 'direct'];
      genome.tone = tones[Math.floor(Math.random() * tones.length)];
    }

    // Mutate temperature
    if (Math.random() < mutationRate) {
      genome.temperature = Math.max(0, Math.min(1, genome.temperature + (Math.random() - 0.5) * 0.3));
    }

    // Mutate tool selection (add/remove)
    if (Math.random() < mutationRate) {
      const allTools = ['read', 'write', 'edit', 'bash', 'grep', 'find', 'ls', 'glob', 'search'];
      if (genome.toolSelection.length < 3) {
        // Add a tool
        const available = allTools.filter(t => !genome.toolSelection.includes(t));
        if (available.length > 0) {
          genome.toolSelection.push(available[Math.floor(Math.random() * available.length)]);
        }
      } else if (genome.toolSelection.length > 5 && Math.random() < 0.5) {
        // Remove a tool
        const idx = Math.floor(Math.random() * genome.toolSelection.length);
        genome.toolSelection.splice(idx, 1);
      }
    }

    // Mutate thinking level
    if (Math.random() < mutationRate * 0.5) {
      const levels: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
      genome.thinkingLevel = levels[Math.floor(Math.random() * levels.length)];
    }
  }

  /**
   * Create a mutated copy of a genome (used in crossover variant)
   */
  private mutateGenome(genome: PromptGenome, rate: number): PromptGenome {
    const copy = JSON.parse(JSON.stringify(genome)) as PromptGenome;
    this.mutate(copy, rate);
    return copy;
  }

  /**
   * Serialize genome for storage
   */
  serialize(genome: PromptGenome): string {
    return JSON.stringify(genome);
  }

  /**
   * Deserialize genome
   */
  deserialize(data: string): PromptGenome {
    return JSON.parse(data);
  }

  /**
   * Apply optimized genome to agent config
   */
  applyToConfig(config: AgentConfig, genome: PromptGenome): OptimizedAgentConfig {
    return {
      ...config,
      systemPrompt: this.buildPrompt(genome),
      tools: genome.toolSelection,
      thinkingLevel: genome.thinkingLevel,
      temperature: genome.temperature,
      maxTokens: genome.maxTokens,
    };
  }
}
