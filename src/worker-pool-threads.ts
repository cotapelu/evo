// worker-pool-threads.ts - True thread pool using worker_threads (Iteration 113)
// ESM-compatible worker pool for parallel task execution

import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import * as path from 'path';
import * as os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ThreadTask<T = any> {
  id: string;
  module: string; // Module path to import
  fnName: string; // Function name to call
  args: any[];
  resolve: (value: T | Promise<T>) => void;
  reject: (error: Error) => void;
  timeout: number;
}

export class WorkerPoolThreads {
  private size: number;
  private nextWorkerIndex: number = 0; // for round-robin distribution
  private workers: Worker[] = [];
  private taskQueue: ThreadTask[] = [];
  private pendingTasks: Map<string, ThreadTask> = new Map(); // taskId -> task
  private activeWorkers: number = 0;
  private initialized: boolean = false;
  private workerScript: string;

  constructor(size: number = 4, workerScript?: string) {
    this.size = Math.max(1, Math.min(size, os.cpus().length));
    // Default worker script
    this.workerScript = workerScript || path.join(__dirname, 'worker-thread.js');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    for (let i = 0; i < this.size; i++) {
      this.spawnWorker(i);
    }
    this.initialized = true;
  }

  private spawnWorker(index: number): void {
    try {
      const worker = new Worker(this.workerScript, {
        workerData: { poolId: index }
      });

      worker.on('message', (msg: any) => this.handleMessage(worker, msg));
      worker.on('error', (err: Error) => this.handleError(worker, err));
      worker.on('exit', (code: number | null) => this.handleExit(worker, code));

      this.workers[index] = worker;
    } catch (e) {
      console.error('[WorkerPoolThreads] Failed to spawn worker:', e);
    }
  }

  private handleMessage(worker: Worker, msg: any): void {
    if (msg.type === 'ready') {
      // Worker is ready to receive tasks
      this.processQueue();
    } else if (msg.type === 'result') {
      const task = this.pendingTasks.get(msg.taskId);
      if (task) {
        task.resolve(msg.result);
        this.pendingTasks.delete(msg.taskId);
        this.activeWorkers--;
        this.processQueue();
      }
    } else if (msg.type === 'error') {
      const task = this.pendingTasks.get(msg.taskId);
      if (task) {
        task.reject(new Error(msg.error));
        this.pendingTasks.delete(msg.taskId);
        this.activeWorkers--;
        this.processQueue();
      }
    }
  }

  private handleError(worker: Worker, err: Error): void {
    console.error('[WorkerPoolThreads] Worker error:', err);
    this.replaceWorker(worker);
  }

  private handleExit(worker: Worker, code: number | null): void {
    if (code !== 0) {
      console.warn(`[WorkerPoolThreads] Worker exited with code ${code}, replacing...`);
      this.replaceWorker(worker);
    }
  }

  private replaceWorker(oldWorker: Worker): void {
    const index = this.workers.indexOf(oldWorker);
    if (index !== -1) {
      this.workers[index] = null as any;
      // Respawn
      setTimeout(() => this.spawnWorker(index), 100);
    }
  }

  execute<T = any>(module: string, fnName: string, args: any[], options: { timeout?: number } = {}): Promise<T> {
    if (!this.initialized) {
      throw new Error('WorkerPoolThreads not initialized');
    }

    return new Promise((resolve, reject) => {
      const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timeout = options.timeout || 30000;
      const task: ThreadTask<T> = {
        id: taskId,
        module,
        fnName,
        args,
        resolve: resolve as (value: T | Promise<T>) => void,
        reject: (err: Error) => reject(err),
        timeout
      };

      this.pendingTasks.set(taskId, task);
      this.taskQueue.push(task);
      this.processQueue();

      // Timeout handling
      setTimeout(() => {
        if (this.pendingTasks.has(taskId)) {
          task.reject(new Error('Task timeout'));
          this.pendingTasks.delete(taskId);
          this.activeWorkers--;
          this.processQueue();
        }
      }, timeout);
    });
  }

  private processQueue(): void {
    if (this.activeWorkers >= this.size || this.taskQueue.length === 0) return;

    const task = this.taskQueue.shift();
    if (!task) return;

    // Find an idle worker using round-robin
    let workerIndex = -1;
    const startIndex = this.nextWorkerIndex;
    for (let i = 0; i < this.size; i++) {
      const idx = (startIndex + i) % this.size;
      if (this.workers[idx]) {
        workerIndex = idx;
        this.nextWorkerIndex = (idx + 1) % this.size;
        break;
      }
    }
    if (workerIndex === -1) {
      // No worker available, put task back at front
      this.taskQueue.unshift(task);
      return;
    }

    const worker = this.workers[workerIndex];
    this.activeWorkers++;

    // Send task to worker
    worker.postMessage({
      type: 'task',
      taskId: task.id,
      module: task.module,
      fnName: task.fnName,
      args: task.args
    });
  }

  private dispatchTask(worker: Worker): void {
    // In full implementation: send task to worker
    // For now: just process locally
    this.processQueue();
  }

  shutdown(): void {
    for (const w of this.workers) {
      if (w) w.terminate().catch(() => {});
    }
    this.workers = [];
    this.taskQueue = [];
    this.pendingTasks.forEach((task, taskId) => {
      task.reject(new Error('WorkerPool shut down'));
    });
    this.pendingTasks.clear();
    this.activeWorkers = 0;
    this.initialized = false;
  }

  get stats(): { queued: number; active: number; total: number; pending: number } {
    return {
      queued: this.taskQueue.length,
      active: this.activeWorkers,
      total: this.size,
      pending: this.pendingTasks.size
    };
  }
}
