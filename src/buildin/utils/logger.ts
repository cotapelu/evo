// ============================================================================
// 1. IMPORTS
// ============================================================================

import { getCorrelationId } from './async-context.js';
import { metrics, METRIC_NAMES } from './metrics.js';

// ============================================================================
// 2. PUBLIC API
// ============================================================================

/**
 * Simple logger utility for built-in extensions.
 * Provides namespaced logging with console fallback, including correlation ID when available.
 */

export interface Logger {
  log(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
}

/**
 * Creates a logger with a namespace prefix.
 */
export function createLogger(namespace: string): Logger {
  const prefix = `[${namespace}]`;

  const enrichMeta = (meta?: unknown) => {
    const cid = getCorrelationId();
    if (cid) {
      if (typeof meta === 'object' && meta !== null) {
        return { ...meta, correlation_id: cid };
      }
      return { correlation_id: cid };
    }
    return meta;
  };

  const recordMetric = () => {
    metrics.incrementCounter(METRIC_NAMES.LOGGER_CALL, 1);
  };

  return {
    log(message: string, meta?: unknown) {
      const start = performance.now();
      console.log(`${prefix} ${message}`, enrichMeta(meta) ?? '');
      recordMetric();
      metrics.observeHistogram(METRIC_NAMES.LOGGER_OVERHEAD_MS, performance.now() - start);
    },
    error(message: string, meta?: unknown) {
      const start = performance.now();
      console.error(`${prefix} ${message}`, enrichMeta(meta) ?? '');
      recordMetric();
      metrics.observeHistogram(METRIC_NAMES.LOGGER_OVERHEAD_MS, performance.now() - start);
    },
    warn(message: string, meta?: unknown) {
      const start = performance.now();
      console.warn(`${prefix} ${message}`, enrichMeta(meta) ?? '');
      recordMetric();
      metrics.observeHistogram(METRIC_NAMES.LOGGER_OVERHEAD_MS, performance.now() - start);
    },
    info(message: string, meta?: unknown) {
      const start = performance.now();
      console.info(`${prefix} ${message}`, enrichMeta(meta) ?? '');
      recordMetric();
      metrics.observeHistogram(METRIC_NAMES.LOGGER_OVERHEAD_MS, performance.now() - start);
    },
  };
}
