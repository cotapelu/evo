import { describe, it, expect, beforeEach } from 'vitest';
import { metrics, METRIC_NAMES } from './metrics.js';

describe('metrics', () => {
  beforeEach(() => {
    metrics.reset();
  });

  describe('counters', () => {
    it('should increment counter', () => {
      metrics.incrementCounter('test.counter');
      expect(metrics.getCounter('test.counter')).toBe(1);
    });

    it('should increment by delta', () => {
      metrics.incrementCounter('test.counter', 5);
      expect(metrics.getCounter('test.counter')).toBe(5);
    });

    it('should accumulate increments', () => {
      metrics.incrementCounter('test.counter');
      metrics.incrementCounter('test.counter', 3);
      expect(metrics.getCounter('test.counter')).toBe(4);
    });

    it('should return 0 for unknown counter', () => {
      expect(metrics.getCounter('unknown')).toBe(0);
    });
  });

  describe('gauges', () => {
    it('should set gauge', () => {
      metrics.setGauge('test.gauge', 42);
      expect(metrics.getGauge('test.gauge')).toBe(42);
    });

    it('should overwrite gauge', () => {
      metrics.setGauge('test.gauge', 10);
      metrics.setGauge('test.gauge', 20);
      expect(metrics.getGauge('test.gauge')).toBe(20);
    });

    it('should return 0 for unknown gauge', () => {
      expect(metrics.getGauge('unknown')).toBe(0);
    });
  });

  describe('histograms', () => {
    it('should record observations', () => {
      metrics.observeHistogram('test.hist', 100);
      metrics.observeHistogram('test.hist', 200);
      const hist = metrics.getHistogram('test.hist');
      expect(hist).toEqual({
        count: 2,
        sum: 300,
        min: 100,
        max: 200,
      });
    });

    it('should handle single observation', () => {
      metrics.observeHistogram('test.hist', 50);
      const hist = metrics.getHistogram('test.hist');
      expect(hist).toEqual({
        count: 1,
        sum: 50,
        min: 50,
        max: 50,
      });
    });

    it('should return undefined for unknown histogram', () => {
      expect(metrics.getHistogram('unknown')).toBeUndefined();
    });
  });

  describe('snapshot', () => {
    it('should export all metrics', () => {
      metrics.incrementCounter('counter1', 5);
      metrics.setGauge('gauge1', 10);
      metrics.observeHistogram('hist1', 100);

      const snap = metrics.snapshot();
      expect(snap.counters).toEqual({ counter1: 5 });
      expect(snap.gauges).toEqual({ gauge1: 10 });
      expect(snap.histograms).toEqual({
        hist1: { count: 1, sum: 100, min: 100, max: 100 },
      });
    });
  });

  describe('reset', () => {
    it('should clear all metrics', () => {
      metrics.incrementCounter('c1', 3);
      metrics.setGauge('g1', 7);
      metrics.observeHistogram('h1', 50);
      metrics.reset();
      expect(metrics.getCounter('c1')).toBe(0);
      expect(metrics.getGauge('g1')).toBe(0);
      expect(metrics.getHistogram('h1')).toBeUndefined();
    });
  });

  describe('METRIC_NAMES', () => {
    it('should define expected metric names', () => {
      expect(METRIC_NAMES.SESSION_START).toBe('procman.session.start.total');
      expect(METRIC_NAMES.CORRELATION_ID_GENERATED).toBe('procman.correlation_id.generated.total');
      expect(METRIC_NAMES.LOGGER_CALL).toBe('procman.logger.call.total');
      expect(METRIC_NAMES.AUTO_CONTINUE_ACTIVATED).toBe('procman.auto_continue.activated.total');
      expect(METRIC_NAMES.TOOL_INVOCATION).toBe('procman.tool.invocation.total');
      expect(METRIC_NAMES.SESSION_DURATION_MS).toBe('procman.session.duration.ms');
      expect(METRIC_NAMES.TOOL_EXECUTION_MS).toBe('procman.tool.execution.ms');
      expect(METRIC_NAMES.ACTIVE_SESSIONS).toBe('procman.sessions.active');
    });
  });
});
