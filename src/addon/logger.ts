const logLevel = process.env.PI_LOG_LEVEL as 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | undefined;
const logFormat = process.env.PI_LOG_FORMAT as 'pretty' | 'json' | undefined;
type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const enabledLevels = logLevel ? new Set([logLevel]) : null;

function isEnabled(level: LogLevel): boolean {
  if (!enabledLevels) return false;
  return enabledLevels.has(level);
}

function makePrettyLogger(level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal') {
  return (...args: unknown[]) => {
    if (isEnabled(level)) {
      switch (level) {
        case 'trace':
          console.trace(`[${level.toUpperCase()}]`, ...args);
          break;
        case 'debug':
          console.debug(`[${level.toUpperCase()}]`, ...args);
          break;
        case 'info':
          console.info(`[${level.toUpperCase()}]`, ...args);
          break;
        case 'warn':
          console.warn(`[${level.toUpperCase()}]`, ...args);
          break;
        case 'error':
          console.error(`[${level.toUpperCase()}]`, ...args);
          break;
        case 'fatal':
          console.error(`[${level.toUpperCase()}]`, ...args);
          break;
        default:
          break;
      }
    }
  };
}

function makeJsonLogger(level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal') {
  return (...args: unknown[]) => {
    if (isEnabled(level)) {
      const msg = args.length > 0 ? args[0] : undefined;
      const rest = args.slice(1);
      const entry = {
        timestamp: new Date().toISOString(),
        level,
        message: msg,
        ...(rest.length > 0 ? { meta: rest } : {}),
      };
      console.log(JSON.stringify(entry));
    }
  };
}

const noop = () => undefined;

const createLogger =
  logFormat === 'json'
    ? (level: LogLevel) => makeJsonLogger(level)
    : (level: LogLevel) => makePrettyLogger(level);

const logger = {
  trace: logLevel ? createLogger('trace') : noop,
  debug: logLevel ? createLogger('debug') : noop,
  info: logLevel ? createLogger('info') : noop,
  warn: logLevel ? createLogger('warn') : noop,
  error: logLevel ? createLogger('error') : noop,
  fatal: logLevel ? createLogger('fatal') : noop,
};

export { logger };


