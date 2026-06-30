// ============================================================================
// 1. IMPORTS
// ============================================================================

// (No external imports)

// ============================================================================
// 2. PRIVATE IMPLEMENTATION (class first)
// ============================================================================

interface MetricValue {
  count: number;
  sum: number;
  min: number;
  max: number;
}

class MetricsRegistry {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, MetricValue> = new Map();

  /** Increment a counter by 1 (or by delta). */
  incrementCounter(name: string, delta: number = 1): void {
    const current = this.counters.get(name) ?? 0;
    this.counters.set(name, current + delta);
  }

  /** Set a gauge to a specific value. */
  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  /** Record a timing observation (milliseconds) in a histogram. */
  observeHistogram(name: string, milliseconds: number): void {
    const existing = this.histograms.get(name);
    if (!existing) {
      this.histograms.set(name, {
        count: 1,
        sum: milliseconds,
        min: milliseconds,
        max: milliseconds,
      });
    } else {
      existing.count += 1;
      existing.sum += milliseconds;
      if (milliseconds < existing.min) existing.min = milliseconds;
      if (milliseconds > existing.max) existing.max = milliseconds;
    }
  }

  /** Get current counter value. */
  getCounter(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  /** Get current gauge value. */
  getGauge(name: string): number {
    return this.gauges.get(name) ?? 0;
  }

  /** Get histogram statistics. */
  getHistogram(name: string): MetricValue | undefined {
    return this.histograms.get(name);
  }

  /** Reset all metrics (useful for testing). */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  /** Export all metrics as a plain object (for logging or monitoring). */
  snapshot(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, MetricValue>;
  } {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(this.histograms),
    };
  }
}

// ============================================================================
// 3. PUBLIC API (constants + singleton)
// ============================================================================

/**
 * Simple in-memory metrics collector for procman.
 * Provides counters, gauges, and histograms for observability.
 * In production, this could be extended to export to Prometheus, OpenTelemetry, etc.
 */

// Predefined metric names
export const METRIC_NAMES = {
  // Counters
  SESSION_START: 'procman.session.start.total',
  SESSION_ERROR: 'procman.session.error.total',
  CORRELATION_ID_GENERATED: 'procman.correlation_id.generated.total',
  LOGGER_CALL: 'procman.logger.call.total',
  AUTO_CONTINUE_ACTIVATED: 'procman.auto_continue.activated.total',
  AUTO_CONTINUE_DEACTIVATED: 'procman.auto_continue.deactivated.total',
  TOOL_INVOCATION: 'procman.tool.invocation.total',

  // Histograms
  SESSION_DURATION_MS: 'procman.session.duration.ms',
  TOOL_EXECUTION_MS: 'procman.tool.execution.ms',
  LOGGER_OVERHEAD_MS: 'procman.logger.overhead.ms',

  // Gauges
  ACTIVE_SESSIONS: 'procman.sessions.active',
  ENABLED_AUTO_CONTINUE: 'procman.auto_continue.enabled.gauge',
} as const;

// Singleton registry
export const metrics = new MetricsRegistry();
