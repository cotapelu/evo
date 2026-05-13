// Worker Pool Implementation for EvoAgent
// Manages a pool of worker threads for parallel task execution

import { Worker } from 'worker_threads';
import * as path from 'path';

interface WorkerTask {
  id: string;
  type: 'analyze' | 'transform' | 'test' | 'deploy';
  data: any;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

export class WorkerPool {
  private workers: Worker[] = [];
  private queue: WorkerTask[] = [];
  private maxWorkers: number;
  private busyCount: number = 0;
  private agentId: string;
  private basePath: string;

  constructor(agentId: string, maxWorkers: number = 4, basePath?: string) {
    this.agentId = agentId;
    this.maxWorkers = maxWorkers;
    this.basePath = basePath || process.cwd();
  }

  async initialize(): Promise<void> {
    const workerPath = path.resolve(this.basePath, 'worker.js');
    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = new Worker(workerPath, {
        workerData: { agentId: this.agentId, workerId: i }
      });
      worker.on('message', (msg: any) => this.handleWorkerMessage(msg));
      worker.on('error', (err: Error) => this.handleWorkerError(err));
      this.workers.push(worker);
    }
    console.log(`[WorkerPool] Initialized ${this.maxWorkers} workers`);
  }

  private handleWorkerMessage(msg: any): void {
    if (msg.type === 'result') {
      const task = this.queue.find(t => t.id === msg.taskId);
      if (task) {
        this.queue = this.queue.filter(t => t.id !== msg.taskId);
        this.busyCount--;
        task.resolve(msg.result);
        this.processQueue();
      }
    }
  }

  private handleWorkerError(err: Error): void {
    console.error('[WorkerPool] Worker error:', err);
    this.busyCount--;
    this.processQueue(); // Continue with next task
  }

  submit<T>(type: WorkerTask['type'], data: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const task: WorkerTask = {
        id: `${this.agentId}-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
        type,
        data,
        resolve: (result: any) => resolve(result),
        reject: (error: Error) => reject(error)
      };
      this.queue.push(task);
      this.processQueue();
    });
  }

  private processQueue(): void {
    while (this.queue.length > 0 && this.busyCount < this.maxWorkers) {
      const task = this.queue.shift();
      if (!task) break;
      this.busyCount++;
      // Send to first available worker (round-robin simple)
      const worker = this.workers[this.busyCount % this.maxWorkers];
      if (worker) {
        worker.postMessage({ taskId: task.id, type: task.type, data: task.data });
      } else {
        this.queue.unshift(task);
        this.busyCount--;
        break;
      }
    }
  }

  getStats(): { queueSize: number; busy: number; total: number } {
    return {
      queueSize: this.queue.length,
      busy: this.busyCount,
      total: this.maxWorkers
    };
  }

  async shutdown(): Promise<void> {
    for (const worker of this.workers) {
      await worker.terminate();
    }
    this.workers = [];
    this.queue = [];
    this.busyCount = 0;
  }
}

// For standalone worker execution
if (require.main === module) {
  const { parentPort, workerData } = require('worker_threads');

  parentPort.on('message', (msg: any) => {
    const { taskId, type, data } = msg;
    try {
      let result: any;
      switch (type) {
        case 'analyze':
          result = { complexity: Math.random() * 100, suggestions: ['refactor'], score: 0.7 };
          break;
        case 'transform':
          result = { code: data.code.replace(/console\.log/g, 'Logger.log'), transformed: true };
          break;
        case 'test':
          result = { passed: true, duration: Math.random() * 1000 };
          break;
        default:
          result = { ok: true };
      }
      parentPort.postMessage({ type: 'result', taskId, result });
    } catch (err: any) {
      parentPort.postMessage({ type: 'error', taskId, error: err.message });
    }
  });
}
