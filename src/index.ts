// index.ts - Barrel exports for evo modules
// Centralized import point for all agent modules

export { FileSystem } from './filesystem.js';
export type { FileSystemConfig } from './filesystem.js';

export { Message, MessageQueue } from './messaging.js';

export { Goal, GoalManager } from './goals.js';

export { HealthMonitor, HealthStatus, ResourceLimits } from './health.js';
