/**
 * Genetic Evolution Strategy
 * Uses evolutionary algorithms to optimize improvement selection
 */

export interface ImprovementCandidate {
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  complexity: number; // 1-10 scale
  risk: number; // 1-10 scale (higher = more risky
  expectedImpact: number; // 1-10 scale
  diff?: string; // optional actual diff
}

export interface Individual {
  id: string;
  genes: {
    priorityWeight: number;
    categoryPreference: Record<string, number>;
    complexityPreference: number;
    riskTolerance: number;
  };
  fitness: number; // success rate of this strategy
  history: Array<{
    candidate: ImprovementCandidate;
    applied: boolean;
    success: boolean;
  }>;
}

export class GeneticEvolutionStrategy {
  private population: Individual[] = [];
  private generation: number = 0;
  private populationSize: number = 10;
  private mutationRate: number = 0.1;
  private crossoverRate: number = 0.7;
  private logger: any;

  constructor(logger: any, populationSize: number = 10) {
    this.logger = logger;
    this.populationSize = populationSize;
    this.initializePopulation();
  }

  private initializePopulation(): void {
    for (let i = 0; i < this.populationSize; i++) {
      this.population.push(this.createRandomIndividual());
    }
    this.logger.debug(`🧬 Genetic strategy: Initialized population of ${this.populationSize} individuals`);
  }

  private createRandomIndividual(): Individual {
    const categories = ['bugfix', 'performance', 'security', 'testing', 'refactoring', 'typescript', 'documentation', 'other'];
    const categoryPreference: Record<string, number> = {};
    for (const cat of categories) {
      categoryPreference[cat] = Math.random();
    }

    return {
      id: this.generateId(),
      genes: {
        priorityWeight: Math.random() * 2, // 0-2
        categoryPreference,
        complexityPreference: Math.random() * 2 - 1, // -1 to 1 (prefers simple or complex)
        riskTolerance: Math.random() * 2, // 0-2
      },
      fitness: 0,
      history: [],
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Evaluate fitness of an individual based on its history
   */
  private evaluateFitness(individual: Individual): number {
    if (individual.history.length === 0) return 0.5; // neutral for new individuals

    const successes = individual.history.filter(h => h.success).length;
    const total = individual.history.length;
    const baseRate = successes / total;

    // Bonus for diversity (used different categories)
    const categoriesUsed = new Set(individual.history.map(h => h.candidate.category)).size;
    const diversityBonus = categoriesUsed / 8; // 8 total categories

    // Penalty for too many failures in a row
    const recentHistory = individual.history.slice(-5);
    const recentFailures = recentHistory.filter(h => !h.success).length;
    const failurePenalty = recentFailures > 3 ? 0.5 : 1;

    return baseRate * 0.6 + diversityBonus * 0.2 + failurePenalty * 0.2;
  }

  /**
   * Select an improvement candidate using tournament selection
   */
  selectCandidate(candidates: ImprovementCandidate[]): ImprovementCandidate | null {
    if (candidates.length === 0) return null;

    // Evaluate all individuals
    for (const individual of this.population) {
      individual.fitness = this.evaluateFitness(individual);
    }

    // Tournament selection: pick best of random sample
    const tournamentSize = Math.min(3, this.population.length);
    const tournament = [];
    for (let i = 0; i < tournamentSize; i++) {
      const randomIdx = Math.floor(Math.random() * this.population.length);
      tournament.push(this.population[randomIdx]);
    }

    const winner = tournament.reduce((best, current) =>
      current.fitness > best.fitness ? current : best
    );

    // Use winner's genes to score candidates
    const scoredCandidates = candidates.map(candidate => ({
      candidate,
      score: this.scoreCandidate(candidate, winner.genes)
    }));

    // Select top candidate
    scoredCandidates.sort((a, b) => b.score - a.score);
    const selected = scoredCandidates[0].candidate;

    this.logger.debug(`🧬 Strategy selected improvement: ${selected.description.substring(0, 50)}... (score: ${scoredCandidates[0].score.toFixed(2)})`);

    return selected;
  }

  /**
   * Score a candidate based on individual's genes
   */
  private scoreCandidate(candidate: ImprovementCandidate, genes: Individual['genes']): number {
    let score = 0;

    // Priority factor (high priority gets boost)
    const priorityMultiplier = candidate.priority === 'high' ? genes.priorityWeight :
                              candidate.priority === 'medium' ? 1 : 1 / genes.priorityWeight;
    score += priorityMultiplier * 10;

    // Category preference
    const categoryPref = genes.categoryPreference[candidate.category] || 0.5;
    score += categoryPref * 20;

    // Complexity preference (match)
    const complexityDiff = Math.abs(candidate.complexity - (genes.complexityPreference * 5 + 5)); // 0-10 scale
    score += (10 - complexityDiff) * 2;

    // Risk tolerance
    const riskDiff = Math.abs(candidate.risk - (genes.riskTolerance * 5));
    score += (10 - riskDiff) * 2;

    // Expected impact always positive
    score += candidate.expectedImpact * 3;

    // Add some randomness for exploration
    score += (Math.random() - 0.5) * 5;

    return score;
  }

  /**
   * Record outcome of applying an improvement (for fitness evaluation)
   */
  recordOutcome(individualId: string, candidate: ImprovementCandidate, success: boolean): void {
    const individual = this.population.find(i => i.id === individualId);
    if (individual) {
      individual.history.push({
        candidate,
        applied: true,
        success,
      });

      // Re-evaluate fitness
      individual.fitness = this.evaluateFitness(individual);

      // Evolve population every few evaluations
      if (individual.history.length % 5 === 0) {
        this.evolve();
      }
    }
  }

  /**
   * Evolve the population using genetic operators
   */
  private evolve(): void {
    this.generation++;

    // Sort by fitness
    this.population.sort((a, b) => b.fitness - a.fitness);

    // Keep top 20% (elitism)
    const eliteCount = Math.max(1, Math.floor(this.populationSize * 0.2));
    const elite = this.population.slice(0, eliteCount);

    // Create offspring
    const offspring: Individual[] = [];

    while (offspring.length < this.populationSize - eliteCount) {
      // Select parents via tournament
      const parent1 = this.tournamentSelect();
      const parent2 = this.tournamentSelect();

      // Crossover
      let child: Individual;
      if (Math.random() < this.crossoverRate) {
        child = this.crossover(parent1, parent2);
      } else {
        child = this.cloneIndividual(parent1);
      }

      // Mutation
      if (Math.random() < this.mutationRate) {
        this.mutate(child);
      }

      offspring.push(child);
    }

    // New population
    this.population = [...elite, ...offspring.slice(0, this.populationSize - eliteCount)];

    const avgFitness = this.population.reduce((sum, i) => sum + i.fitness, 0) / this.population.length;
    this.logger.debug(`🧬 Evolution generation ${this.generation}: avg fitness = ${avgFitness.toFixed(3)}`);
  }

  private tournamentSelect(): Individual {
    const tournamentSize = 3;
    const tournament = [];
    for (let i = 0; i < tournamentSize; i++) {
      const randomIdx = Math.floor(Math.random() * this.population.length);
      tournament.push(this.population[randomIdx]);
    }
    return tournament.reduce((best, current) =>
      current.fitness > best.fitness ? current : best
    );
  }

  private crossover(parent1: Individual, parent2: Individual): Individual {
    const child = this.cloneIndividual(parent1);

    // Crossover genes
    for (const key of Object.keys(child.genes) as Array<keyof typeof child.genes>) {
      if (Math.random() < 0.5) {
        (child.genes as any)[key] = (parent2.genes as any)[key];
      }
    }

    // Crossover category preferences with mixing
    for (const cat of Object.keys(child.genes.categoryPreference)) {
      if (Math.random() < 0.5) {
        (child.genes.categoryPreference as any)[cat] = (parent2.genes.categoryPreference as any)[cat];
      }
    }

    child.id = this.generateId();
    child.history = []; // Fresh start
    child.fitness = 0;

    return child;
  }

  private mutate(individual: Individual): void {
    const genes = individual.genes;

    // Mutate priority weight
    if (Math.random() < 0.3) {
      genes.priorityWeight += (Math.random() - 0.5) * 0.5;
      genes.priorityWeight = Math.max(0.1, Math.min(3, genes.priorityWeight));
    }

    // Mutate complexity preference
    if (Math.random() < 0.3) {
      genes.complexityPreference += (Math.random() - 0.5) * 0.5;
      genes.complexityPreference = Math.max(-1, Math.min(1, genes.complexityPreference));
    }

    // Mutate risk tolerance
    if (Math.random() < 0.3) {
      genes.riskTolerance += (Math.random() - 0.5) * 0.5;
      genes.riskTolerance = Math.max(0.1, Math.min(3, genes.riskTolerance));
    }

    // Mutate some category preferences
    const categories = Object.keys(genes.categoryPreference);
    const mutateCount = Math.floor(Math.random() * 3);
    for (let i = 0; i < mutateCount; i++) {
      const cat = categories[Math.floor(Math.random() * categories.length)];
      (genes.categoryPreference as any)[cat] += (Math.random() - 0.5) * 0.3;
      (genes.categoryPreference as any)[cat] = Math.max(0, Math.min(1, (genes.categoryPreference as any)[cat]));
    }

    this.logger.debug(`🧬 Mutated individual ${individual.id}`);
  }

  private cloneIndividual(individual: Individual): Individual {
    return JSON.parse(JSON.stringify({
      ...individual,
      id: this.generateId(),
      history: [],
      fitness: 0
    }));
  }

  /**
   * Get current best individual
   */
  getBestIndividual(): Individual | null {
    if (this.population.length === 0) return null;
    this.population.sort((a, b) => b.fitness - a.fitness);
    return this.population[0];
  }

  /**
   * Get statistics about the population
   */
  getStats(): {
    generation: number;
    populationSize: number;
    avgFitness: number;
    bestFitness: number;
    diversity: number;
  } {
    const fitnesses = this.population.map(i => i.fitness);
    const avgFitness = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
    const bestFitness = Math.max(...fitnesses);

    // Measure diversity (standard deviation of category preferences)
    const categoryVariances: number[] = [];
    const categories = Object.keys(this.population[0]?.genes.categoryPreference || {});
    for (const cat of categories) {
      const values = this.population.map(i => i.genes.categoryPreference[cat]);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      categoryVariances.push(variance);
    }
    const avgVariance = categoryVariances.reduce((a, b) => a + b, 0) / categoryVariances.length;
    const diversity = Math.sqrt(avgVariance);

    return {
      generation: this.generation,
      populationSize: this.population.length,
      avgFitness,
      bestFitness,
      diversity,
    };
  }

  /**
   * Serialize state for persistence
   */
  serialize(): any {
    return {
      generation: this.generation,
      population: this.population,
      populationSize: this.populationSize,
      mutationRate: this.mutationRate,
      crossoverRate: this.crossoverRate,
    };
  }

  /**
   * Deserialize state from persistence
   */
  deserialize(data: any): void {
    this.generation = data.generation;
    this.population = data.population;
    this.populationSize = data.populationSize;
    this.mutationRate = data.mutationRate;
    this.crossoverRate = data.crossoverRate;
  }
}
