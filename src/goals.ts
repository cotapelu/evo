// goals.ts - Goal Management System
// Tracks goals, dependencies, progress, and priority-based scheduling

export interface Goal {
  id: string;
  description: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  steps: string[];
  currentStep: number;
  createdAt: string;
  completedAt?: string;
  dependencies?: string[];
  progress: number; // 0-100 percentage
  metadata?: Record<string, any>;
}

export class GoalManager {
  private goals: Map<string, Goal> = new Map();
  private nextIdCounter: number = 0;

  create(description: string, priority: number = 1, steps?: string[], dependencies?: string[], metadata?: Record<string, any>): Goal {
    const goal: Goal = {
      id: this.generateId(),
      description,
      priority,
      status: 'pending',
      steps: steps || ['Plan', 'Execute', 'Verify'],
      currentStep: 0,
      createdAt: new Date().toISOString(),
      progress: 0,
      dependencies,
      metadata
    };
    this.goals.set(goal.id, goal);
    return goal;
  }

  get(id: string): Goal | undefined {
    return this.goals.get(id);
  }

  getAll(): Goal[] {
    return Array.from(this.goals.values());
  }

  getActive(): Goal[] {
    return this.getAll().filter(g => g.status === 'pending' || g.status === 'in_progress');
  }

  getByPriority(minPriority: number = 1): Goal[] {
    return this.getActive()
      .filter(g => g.priority >= minPriority)
      .sort((a, b) => b.priority - a.priority);
  }

  update(id: string, updates: Partial<Goal>): boolean {
    const goal = this.goals.get(id);
    if (!goal) return false;

    Object.assign(goal, updates);
    if (updates.status === 'completed' && !goal.completedAt) {
      goal.completedAt = new Date().toISOString();
      goal.progress = 100;
    }
    return true;
  }

  advance(id: string): boolean {
    const goal = this.goals.get(id);
    if (!goal) return false;

    // Check dependencies
    if (goal.dependencies) {
      const allDepsMet = goal.dependencies.every(depId => {
        const dep = this.goals.get(depId);
        return dep && dep.status === 'completed';
      });
      if (!allDepsMet) {
        return false;
      }
    }

    if (goal.currentStep < goal.steps.length) {
      goal.currentStep++;
      if (goal.currentStep >= goal.steps.length) {
        goal.status = 'completed';
        goal.completedAt = new Date().toISOString();
        goal.progress = 100;
      } else {
        goal.status = 'in_progress';
        goal.progress = Math.floor((goal.currentStep / goal.steps.length) * 100);
      }
      return true;
    }
    return false;
  }

  fail(id: string, reason?: string): boolean {
    const goal = this.goals.get(id);
    if (!goal) return false;
    goal.status = 'failed';
    if (reason) {
      if (!goal.metadata) goal.metadata = {};
      goal.metadata.failureReason = reason;
    }
    return true;
  }

  cancel(id: string): boolean {
    const goal = this.goals.get(id);
    if (!goal) return false;
    goal.status = 'cancelled';
    return true;
  }

  delete(id: string): boolean {
    return this.goals.delete(id);
  }

  getNextStep(id: string): string | null {
    const goal = this.goals.get(id);
    if (!goal || goal.status === 'completed' || goal.currentStep >= goal.steps.length) return null;
    return goal.steps[goal.currentStep];
  }

  getCompletionStats(): {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    cancelled: number;
    avgProgress: number;
  } {
    const all = this.getAll();
    const pending = all.filter(g => g.status === 'pending').length;
    const inProgress = all.filter(g => g.status === 'in_progress').length;
    const completed = all.filter(g => g.status === 'completed').length;
    const failed = all.filter(g => g.status === 'failed').length;
    const cancelled = all.filter(g => g.status === 'cancelled').length;
    const avgProgress = all.length > 0
      ? Math.round(all.reduce((sum, g) => sum + g.progress, 0) / all.length)
      : 0;

    return {
      total: all.length,
      pending,
      inProgress,
      completed,
      failed,
      cancelled,
      avgProgress
    };
  }

  find(condition: (goal: Goal) => boolean): Goal[] {
    return this.getAll().filter(condition);
  }

  clear(): void {
    this.goals.clear();
  }

  toJSON(): string {
    return JSON.stringify(this.getAll(), null, 2);
  }

  fromJSON(json: string): boolean {
    try {
      const goals = JSON.parse(json) as Goal[];
      this.goals.clear();
      for (const g of goals) {
        this.goals.set(g.id, g);
      }
      return true;
    } catch {
      return false;
    }
  }

  private generateId(): string {
    return `goal-${++this.nextIdCounter}-${Date.now().toString(36)}`;
  }
}
