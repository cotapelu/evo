import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCorrelationId, runWithCorrelationId } from './async-context.js';

describe('async-context', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should return undefined when no correlation ID is set', () => {
    expect(getCorrelationId()).toBeUndefined();
  });

  it('should return the correlation ID within a runWithCorrelationId context', () => {
    const testId = 'test-correlation-id';
    let capturedId: string | undefined;
    runWithCorrelationId(testId, () => {
      capturedId = getCorrelationId();
    });
    expect(capturedId).toBe(testId);
  });



  it('should propagate correlation ID to asynchronous operations within context', async () => {
    const testId = 'propagation-test';
    let innerId: string | undefined;

    const innerAsync = async () => {
      await Promise.resolve();
      innerId = getCorrelationId();
    };

    await runWithCorrelationId(testId, async () => {
      await innerAsync();
    });

    expect(innerId).toBe(testId);
  });

  it('should allow nested contexts with different IDs', () => {
    const outerId = 'outer-id';
    const innerId = 'inner-id';
    let idAtOuter: string | undefined;
    let idAtInner: string | undefined;

    runWithCorrelationId(outerId, () => {
      idAtOuter = getCorrelationId();
      runWithCorrelationId(innerId, () => {
        idAtInner = getCorrelationId();
      });
    });

    expect(idAtOuter).toBe(outerId);
    expect(idAtInner).toBe(innerId);
  });

  it('should revert to previous context after nested context exits', () => {
    const outerId = 'outer';
    let idAfterNested: string | undefined;

    runWithCorrelationId(outerId, () => {
      runWithCorrelationId('inner', () => {
        // inner
      });
      idAfterNested = getCorrelationId();
    });

    expect(idAfterNested).toBe(outerId);
  });
});
