import * as os from 'os';

interface PoolTask<T = any> {
  id: string;
  fn: (...args: any[]) => Promise<T> | T;
  args: any[];
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

export class WorkerPool {
  private size: number;
  private taskQueue: PoolTask[] = [];
  private activeWorkers: number = 0;
  private initialized: boolean = false;

  constructor(size: number = 4) {
    this.size = Math.max(1, Math.min(size, os.cpus().length));
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  execute<T = any>(fn: (...args: any[]) => Promise<T> | T, ...args: any[]): Promise<T> {
    if (!this.initialized) {
      throw new Error('WorkerPool not initialized');
    }

    return new Promise((resolve, reject) => {
      const task: PoolTask<T> = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        fn,
        args,
        resolve: resolve as (value: T) => void,
        reject: (err: Error) => reject(err)
      };

      this.taskQueue.push(task);
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.activeWorkers >= this.size || this.taskQueue.length === 0) return;

    this.activeWorkers++;
    const task = this.taskQueue.shift()!;

    try {
      const result = await task.fn(...task.args);
      task.resolve(result);
    } catch (error) {
      task.reject(error as Error);
    } finally {
      this.activeWorkers--;
      // Process next
      setImmediate(() => this.processQueue());
    }
  }

  shutdown(): void {
    this.taskQueue = [];
    this.activeWorkers = 0;
    this.initialized = false;
  }

  get stats(): { queued: number; active: number; total: number } {
    return {
      queued: this.taskQueue.length,
      active: this.activeWorkers,
      total: this.size
    };
  }
}
