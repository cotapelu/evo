/**
 * Evolution Strategies Module
 * Multiple strategies for selecting improvements
 */

import type { ImprovementCandidate } from './evolution-strategy.js';

export interface StrategyResult {
  selected: ImprovementCandidate;
  confidence: number;
  reasoning: string;
}

export interface EvolutionStrategy {
  name: string;
  description: string;
  select(candidates: ImprovementCandidate[], context: StrategyContext): StrategyResult;
}

export interface StrategyContext {
  totalCycles: number;
  successRate: number;
  recentFailures: number;
  currentLevel: number;
  categoryStats: Record<string, number>;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
}

// 1. Priority-Only Strategy (Simple)
export class PriorityStrategy implements EvolutionStrategy {
  name = 'priority';
  description = 'Selects highest priority improvement';

  select(candidates: ImprovementCandidate[], context: StrategyContext): StrategyResult {
    const priorityMap: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const sorted = [...candidates].sort((a, b) =>
      (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0)
    );

    return {
      selected: sorted[0],
      confidence: 0.8,
      reasoning: `Selected highest priority (${sorted[0].priority})`,
    };
  }
}

// 2. Risk-Averse Strategy (prefers low complexity, low risk)
export class RiskAverseStrategy implements EvolutionStrategy {
  name = 'risk-averse';
  description = 'Prioritizes safe, simple improvements';

  select(candidates: ImprovementCandidate[], context: StrategyContext): StrategyResult {
    const scored = candidates.map(c => ({
      candidate: c,
      score: (11 - c.risk) * 2 + (11 - c.complexity) * 1.5 + c.expectedImpact,
    }));

    scored.sort((a, b) => b.score - a.score);
    return {
      selected: scored[0].candidate,
      confidence: 0.7,
      reasoning: `Risk-averse selection: risk=${scored[0].candidate.risk}, complexity=${scored[0].candidate.complexity}`,
    };
  }
}

// 3. Impact-First Strategy
export class ImpactStrategy implements EvolutionStrategy {
  name = 'impact-first';
  description = 'Maximizes expected impact';

  select(candidates: ImprovementCandidate[], context: StrategyContext): StrategyResult {
    const scored = candidates.map(c => ({
      candidate: c,
      score: c.expectedImpact * 2 - c.complexity * 0.5,
    }));

    scored.sort((a, b) => b.score - a.score);
    return {
      selected: scored[0].candidate,
      confidence: 0.75,
      reasoning: `Impact-focused: expected impact=${scored[0].candidate.expectedImpact}`,
    };
  }
}

// 4. Success-Mimic Strategy (learns from past successes)
export class SuccessMimicStrategy implements EvolutionStrategy {
  name = 'success-mimic';
  description = 'Mimics characteristics of past successful improvements';

  select(candidates: ImprovementCandidate[], context: StrategyContext): StrategyResult {
    // If we have category stats, prefer categories with high success rate
    const categorySuccessRates: Record<string, number> = {};
    for (const [cat, count] of Object.entries(context.categoryStats)) {
      // Assume success rate based on total metrics would come from actual outcomes
      categorySuccessRates[cat] = 0.5; // placeholder
    }

    const scored = candidates.map(c => ({
      candidate: c,
      score: (categorySuccessRates[c.category] || 0.5) * 2 + c.expectedImpact * 1.5 + (c.priority === 'high' ? 1 : 0),
    }));

    scored.sort((a, b) => b.score - a.score);
    return {
      selected: scored[0].candidate,
      confidence: 0.6,
      reasoning: `Learned from past successes in category ${scored[0].candidate.category}`,
    };
  }
}

// 5. Thompson Sampling (Multi-armed Bandit)
export class ThompsonSamplingStrategy implements EvolutionStrategy {
  name = 'thompson-sampling';
  description = 'Bayesian multi-armed bandit for exploration-exploitation';

  private alpha: Record<string, number> = {}; // successes per category
  private beta: Record<string, number> = {};  // failures per category

  constructor() {
    // Initialize all categories
    const categories = ['bugfix', 'performance', 'security', 'testing', 'refactoring', 'typescript', 'documentation', 'other'];
    for (const cat of categories) {
      this.alpha[cat] = 1;
      this.beta[cat] = 1;
    }
  }

  select(candidates: ImprovementCandidate[], context: StrategyContext): StrategyResult {
    // Sample from Beta distribution for each candidate's category
    const scored = candidates.map(c => {
      const alpha = this.alpha[c.category] || 1;
      const beta = this.beta[c.category] || 1;
      const sample = this.sampleBeta(alpha, beta);
      return {
        candidate: c,
        score: sample * c.expectedImpact * (c.priority === 'high' ? 1.2 : 1),
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return {
      selected: scored[0].candidate,
      confidence: 0.9,
      reasoning: `Thompson sampling: explored category ${scored[0].candidate.category} with sample ${scored[0].score.toFixed(2)}`,
    };
  }

  private sampleBeta(alpha: number, beta: number): number {
    // Simplified: use Gamma approximation
    const x = this.gamma(alpha);
    const y = this.gamma(beta);
    return x / (x + y);
  }

  private gamma(shape: number): number {
    // Box-Muller transform for shape > 1 (simplified)
    if (shape < 1) return Math.pow(Math.random(), 1 / shape);
    const u = 0;
    const v = 0;
    // This is a simplification - real implementation would use proper gamma
    return Math.random() * shape;
  }

  // Call this after each cycle outcome
  recordOutcome(category: string, success: boolean): void {
    if (success) {
      this.alpha[category] = (this.alpha[category] || 1) + 1;
    } else {
      this.beta[category] = (this.beta[category] || 1) + 1;
    }
  }

  serialize(): any {
    return { alpha: this.alpha, beta: this.beta };
  }

  deserialize(data: any): void {
    this.alpha = data.alpha;
    this.beta = data.beta;
  }
}

// 6. Context-Aware Strategy (time-based, cycle-based)
export class ContextAwareStrategy implements EvolutionStrategy {
  name = 'context-aware';
  description = 'Adapts strategy based on evolution context';

  select(candidates: ImprovementCandidate[], context: StrategyContext): StrategyResult {
    let selected;

    // If we're early in evolution (low level), prioritize high-impact
    if (context.currentLevel < 5) {
      const impactSorted = [...candidates].sort((a, b) => b.expectedImpact - a.expectedImpact);
      selected = impactSorted[0];
      return {
        selected,
        confidence: 0.85,
        reasoning: 'Early stage: maximizing impact',
      };
    }

    // If recent failures, go risk-averse
    if (context.recentFailures > 2) {
      const riskAverse = new RiskAverseStrategy();
      return riskAverse.select(candidates, context);
    }

    // If success rate is high, be more aggressive (higher complexity OK)
    if (context.successRate > 70) {
      const aggressive = candidates
        .map(c => ({
          candidate: c,
          score: c.expectedImpact * 1.5 + c.priority === 'high' ? 1 : 0,
        }))
        .sort((a, b) => b.score - a.score);
      return {
        selected: aggressive[0].candidate,
        confidence: 0.8,
        reasoning: 'High success rate: taking more aggressive improvements',
      };
    }

    // Default: balanced
    const balanced = new PriorityStrategy();
    return balanced.select(candidates, context);
  }
}

// 7. Ensemble Strategy (combines multiple)
export class EnsembleStrategy implements EvolutionStrategy {
  name = 'ensemble';
  description = 'Combines multiple strategies with weighted voting';

  private strategies: EvolutionStrategy[];

  constructor() {
    this.strategies = [
      new PriorityStrategy(),
      new RiskAverseStrategy(),
      new ImpactStrategy(),
      new ContextAwareStrategy(),
    ];
  }

  select(candidates: ImprovementCandidate[], context: StrategyContext): StrategyResult {
    const votes: Map<string, number> = new Map();

    for (const strategy of this.strategies) {
      const result = strategy.select(candidates, context);
      votes.set(result.selected.description, (votes.get(result.selected.description) || 0) + 1);
    }

    // Find winner
    let maxVotes = 0;
    let winner: ImprovementCandidate | null = null;
    for (const [desc, count] of votes.entries()) {
      if (count > maxVotes) {
        maxVotes = count;
        winner = candidates.find(c => c.description === desc) || candidates[0];
      }
    }

    return {
      selected: winner!,
      confidence: maxVotes / this.strategies.length,
      reasoning: `Ensemble vote: ${maxVotes}/${this.strategies.length} strategies agreed`,
    };
  }
}

// Strategy factory
export class StrategyRegistry {
  private strategies: Map<string, EvolutionStrategy> = new Map();

  constructor() {
    // Register built-in strategies
    this.register(new PriorityStrategy());
    this.register(new RiskAverseStrategy());
    this.register(new ImpactStrategy());
    this.register(new SuccessMimicStrategy());
    this.register(new ThompsonSamplingStrategy());
    this.register(new ContextAwareStrategy());
    this.register(new EnsembleStrategy());
  }

  register(strategy: EvolutionStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  get(name: string): EvolutionStrategy | undefined {
    return this.strategies.get(name);
  }

  list(): EvolutionStrategy[] {
    return Array.from(this.strategies.values());
  }

  getAll(): Record<string, EvolutionStrategy> {
    const result: Record<string, EvolutionStrategy> = {};
    for (const [name, strategy] of this.strategies) {
      result[name] = strategy;
    }
    return result;
  }
}
