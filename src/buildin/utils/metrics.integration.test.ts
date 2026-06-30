import { describe, it, expect, vi, beforeEach } from 'vitest';
import { metrics, METRIC_NAMES } from './metrics.js';
import { getCorrelationId, runWithCorrelationId } from './async-context.js';
import { createLogger } from './logger.js';

describe('Metrics Integration', () => {
  beforeEach(() => {
    metrics.reset();
  });

  it('should correlate logger calls with correlation ID', () => {
    const logger = createLogger('TestNS');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    runWithCorrelationId('test-cid', () => {
      logger.log('Hello');
      expect(metrics.getCounter(METRIC_NAMES.LOGGER_CALL)).toBe(1);
      const snapshot = metrics.snapshot();
      expect(snapshot.histograms[METRIC_NAMES.LOGGER_OVERHEAD_MS]).toBeDefined();
      // Verify correlation ID present in logged meta
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[TestNS]'), expect.objectContaining({ correlation_id: 'test-cid' }));
    });
  });

  it('should increment session metrics on main flow', async () => {
    // Simulate session start
    metrics.incrementCounter(METRIC_NAMES.CORRELATION_ID_GENERATED);
    metrics.setGauge(METRIC_NAMES.ACTIVE_SESSIONS, 1);

    expect(metrics.getCounter(METRIC_NAMES.CORRELATION_ID_GENERATED)).toBe(1);
    expect(metrics.getGauge(METRIC_NAMES.ACTIVE_SESSIONS)).toBe(1);

    // Simulate session end
    metrics.setGauge(METRIC_NAMES.ACTIVE_SESSIONS, 0);
    metrics.observeHistogram(METRIC_NAMES.SESSION_DURATION_MS, 1500);

    expect(metrics.getGauge(METRIC_NAMES.ACTIVE_SESSIONS)).toBe(0);
    const hist = metrics.getHistogram(METRIC_NAMES.SESSION_DURATION_MS);
    expect(hist).toEqual({ count: 1, sum: 1500, min: 1500, max: 1500 });
  });

  it('should record session error without affecting duration', async () => {
    metrics.incrementCounter(METRIC_NAMES.CORRELATION_ID_GENERATED);
    metrics.setGauge(METRIC_NAMES.ACTIVE_SESSIONS, 1);

    // Simulate error
    metrics.incrementCounter(METRIC_NAMES.SESSION_ERROR);

    expect(metrics.getCounter(METRIC_NAMES.SESSION_ERROR)).toBe(1);
    // Still active until finally
    metrics.setGauge(METRIC_NAMES.ACTIVE_SESSIONS, 0);
    expect(metrics.getGauge(METRIC_NAMES.ACTIVE_SESSIONS)).toBe(0);
  });

  it('should auto-continue metrics toggle correctly', () => {
    // Simulate auto-continue activation/deactivation
    metrics.setGauge(METRIC_NAMES.ENABLED_AUTO_CONTINUE, 0);
    metrics.incrementCounter(METRIC_NAMES.AUTO_CONTINUE_DEACTIVATED);

    // Turn on
    metrics.setGauge(METRIC_NAMES.ENABLED_AUTO_CONTINUE, 1);
    metrics.incrementCounter(METRIC_NAMES.AUTO_CONTINUE_ACTIVATED);

    // Turn off
    metrics.setGauge(METRIC_NAMES.ENABLED_AUTO_CONTINUE, 0);
    metrics.incrementCounter(METRIC_NAMES.AUTO_CONTINUE_DEACTIVATED);

    expect(metrics.getGauge(METRIC_NAMES.ENABLED_AUTO_CONTINUE)).toBe(0);
    expect(metrics.getCounter(METRIC_NAMES.AUTO_CONTINUE_ACTIVATED)).toBe(1);
    expect(metrics.getCounter(METRIC_NAMES.AUTO_CONTINUE_DEACTIVATED)).toBe(2); // initial + turn off
  });

  it('should propagate correlation ID through async operations', async () => {
    let capturedId: string | undefined;
    const logger = createLogger('AsyncTest');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const innerAsync = async () => {
      await Promise.resolve();
      capturedId = getCorrelationId();
      logger.log('Inside async');
    };

    await runWithCorrelationId('async-cid', async () => {
      await innerAsync();
    });

    expect(capturedId).toBe('async-cid');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[AsyncTest]'), expect.objectContaining({ correlation_id: 'async-cid' }));
  });
});
