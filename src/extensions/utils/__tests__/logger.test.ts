import { jest } from '@jest/globals';
import { createLogger, logger } from '../logger.js';

describe('Logger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleDebugSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('createLogger returns logger with all methods', () => {
    const log = createLogger();
    expect(log).toHaveProperty('log');
    expect(log).toHaveProperty('error');
    expect(log).toHaveProperty('warn');
    expect(log).toHaveProperty('info');
    expect(log).toHaveProperty('debug');
    expect(typeof log.log).toBe('function');
  });

  test('logger without prefix calls console directly', () => {
    const log = createLogger();
    log.log('msg');
    expect(consoleLogSpy).toHaveBeenCalledWith('msg');
    log.error('err');
    expect(consoleErrorSpy).toHaveBeenCalledWith('err');
    log.warn('warn');
    expect(consoleWarnSpy).toHaveBeenCalledWith('warn');
    log.info('info');
    expect(consoleInfoSpy).toHaveBeenCalledWith('info');
    log.debug('debug');
    expect(consoleDebugSpy).toHaveBeenCalledWith('debug');
  });

  test('logger with prefix adds prefix to each call', () => {
    const log = createLogger('TestTag');
    log.log('hello');
    expect(consoleLogSpy).toHaveBeenCalledWith('[TestTag]', 'hello');
    log.error('oops');
    expect(consoleErrorSpy).toHaveBeenCalledWith('[TestTag]', 'oops');
  });

  test('default logger exports', () => {
    expect(logger).toBeDefined();
    expect(logger.log).toBeDefined();
  });
});
