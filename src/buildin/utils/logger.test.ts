import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./async-context.js', () => ({
  getCorrelationId: vi.fn(),
}));

import { createLogger } from './logger.js';

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('log should call console.log with prefix and message', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger('TestNS');
    logger.log('Hello');
    expect(spy).toHaveBeenCalledWith('[TestNS] Hello', '');
    spy.mockRestore();
  });

  it('log should include meta when provided', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger('TestNS');
    logger.log('Hello', { key: 'value' });
    expect(spy).toHaveBeenCalledWith('[TestNS] Hello', { key: 'value' });
    spy.mockRestore();
  });

  it('error should call console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createLogger('TestNS');
    logger.error('Error msg');
    expect(spy).toHaveBeenCalledWith('[TestNS] Error msg', '');
    spy.mockRestore();
  });

  it('error should include meta', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createLogger('TestNS');
    logger.error('Error msg', { code: 500 });
    expect(spy).toHaveBeenCalledWith('[TestNS] Error msg', { code: 500 });
    spy.mockRestore();
  });

  it('warn should call console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createLogger('TestNS');
    logger.warn('Warn msg');
    expect(spy).toHaveBeenCalledWith('[TestNS] Warn msg', '');
    spy.mockRestore();
  });

  it('warn should include meta', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createLogger('TestNS');
    logger.warn('Warn msg', { retry: true });
    expect(spy).toHaveBeenCalledWith('[TestNS] Warn msg', { retry: true });
    spy.mockRestore();
  });

  it('info should call console.info', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = createLogger('TestNS');
    logger.info('Info msg');
    expect(spy).toHaveBeenCalledWith('[TestNS] Info msg', '');
    spy.mockRestore();
  });

  it('info should include meta', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = createLogger('TestNS');
    logger.info('Info msg', { source: 'test' });
    expect(spy).toHaveBeenCalledWith('[TestNS] Info msg', { source: 'test' });
    spy.mockRestore();
  });

  it('should enrich meta with correlation_id when available (meta is object)', async () => {
    const { getCorrelationId } = await import('./async-context.js');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(getCorrelationId).mockReturnValue('corr-123');
    const logger = createLogger('TestNS');
    logger.log('Hello', { key: 'value' });
    expect(spy).toHaveBeenCalledWith('[TestNS] Hello', { key: 'value', correlation_id: 'corr-123' });
    spy.mockRestore();
  });

  it('should enrich meta with correlation_id when meta is not object', async () => {
    const { getCorrelationId } = await import('./async-context.js');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(getCorrelationId).mockReturnValue('corr-456');
    const logger = createLogger('TestNS');
    logger.log('Hello'); // meta undefined
    expect(spy).toHaveBeenCalledWith('[TestNS] Hello', { correlation_id: 'corr-456' });
    spy.mockRestore();
  });

  it('should not enrich meta when no correlation ID', async () => {
    const { getCorrelationId } = await import('./async-context.js');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(getCorrelationId).mockReturnValue(undefined);
    const logger = createLogger('TestNS');
    logger.log('Hello', { key: 'value' });
    expect(spy).toHaveBeenCalledWith('[TestNS] Hello', { key: 'value' });
    spy.mockRestore();
  });

  it('error should enrich meta with correlation_id when meta is object', async () => {
    const { getCorrelationId } = await import('./async-context.js');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getCorrelationId).mockReturnValue('corr-789');
    const logger = createLogger('TestNS');
    logger.error('Error', { code: 500 });
    expect(spy).toHaveBeenCalledWith('[TestNS] Error', { code: 500, correlation_id: 'corr-789' });
    spy.mockRestore();
  });

  it('warn should enrich meta with correlation_id when meta is object', async () => {
    const { getCorrelationId } = await import('./async-context.js');
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(getCorrelationId).mockReturnValue('corr-warn');
    const logger = createLogger('TestNS');
    logger.warn('Warning', { retry: true });
    expect(spy).toHaveBeenCalledWith('[TestNS] Warning', { retry: true, correlation_id: 'corr-warn' });
    spy.mockRestore();
  });

  it('info should enrich meta with correlation_id when meta is object', async () => {
    const { getCorrelationId } = await import('./async-context.js');
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.mocked(getCorrelationId).mockReturnValue('corr-info');
    const logger = createLogger('TestNS');
    logger.info('Info', { source: 'test' });
    expect(spy).toHaveBeenCalledWith('[TestNS] Info', { source: 'test', correlation_id: 'corr-info' });
    spy.mockRestore();
  });

  it('should enrich meta with correlation_id when meta is null', async () => {
    const { getCorrelationId } = await import('./async-context.js');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(getCorrelationId).mockReturnValue('corr-null');
    const logger = createLogger('TestNS');
    logger.log('Hello', null);
    expect(spy).toHaveBeenCalledWith('[TestNS] Hello', { correlation_id: 'corr-null' });
    spy.mockRestore();
  });
});
