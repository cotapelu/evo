// utils.ts - Common utility functions

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function safeStringify(obj: any): string {
  try {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      return value;
    }, 2);
  } catch (e) {
    return `{"error": "Failed to stringify: ${e}"}`;
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getMemoryUsage(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  }
  return 0;
}

export function getCpuTime(): number {
  if (typeof process !== 'undefined' && process.cpuUsage) {
    return Math.round(process.cpuUsage().user / 1000);
  }
  return 0;
}

export function getUptime(): number {
  if (typeof process !== 'undefined' && process.uptime) {
    return Math.round(process.uptime());
  }
  return 0;
}
