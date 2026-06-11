class JsonFormatter {
    static format(level, message, meta) {
        const context = {
            timestamp: new Date().toISOString(),
            level,
            message,
            meta,
        };
        return JSON.stringify(context);
    }
}
class PrettyFormatter {
    static colors = {
        debug: (s) => `\x1b[90m${s}\x1b[0m`, // gray
        info: (s) => s,
        warn: (s) => `\x1b[33m${s}\x1b[0m`, // yellow
        error: (s) => `\x1b[31m${s}\x1b[0m`, // red
    };
    static format(level, message) {
        const colorize = this.colors[level] || ((s) => s);
        const prefix = level === 'info' ? '' : `[${level.toUpperCase()}] `;
        return colorize(prefix + message);
    }
}
function getLogLevel() {
    const envLevel = process.env.EVO_LOG_LEVEL?.toLowerCase();
    switch (envLevel) {
        case 'debug':
        case 'info':
        case 'warn':
        case 'error':
            return envLevel;
        default:
            return 'info'; // default
    }
}
function getLogFormat() {
    const format = process.env.EVO_LOG_FORMAT?.toLowerCase();
    return format === 'json' ? 'json' : 'pretty';
}
function shouldLog(level) {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevel = getLogLevel();
    return levels.indexOf(level) >= levels.indexOf(currentLevel);
}
function formatMessage(level, message, meta) {
    const format = getLogFormat();
    if (format === 'json') {
        return JsonFormatter.format(level, message, meta);
    }
    return PrettyFormatter.format(level, message);
}
function logToConsole(level, message, meta) {
    const formatted = formatMessage(level, message, meta);
    switch (level) {
        case 'error':
            console.error(formatted);
            break;
        case 'warn':
            console.warn(formatted);
            break;
        case 'debug':
        case 'info':
        default:
            console.log(formatted);
    }
}
export const logger = {
    debug: (message, meta) => {
        if (shouldLog('debug')) {
            logToConsole('debug', message, meta);
        }
    },
    info: (message, meta) => {
        if (shouldLog('info')) {
            logToConsole('info', message, meta);
        }
    },
    log: (message, meta) => {
        if (shouldLog('info')) {
            logToConsole('info', message, meta);
        }
    },
    warn: (message, meta) => {
        if (shouldLog('warn')) {
            logToConsole('warn', message, meta);
        }
    },
    error: (message, meta) => {
        if (shouldLog('error')) {
            logToConsole('error', message, meta);
        }
    },
};
//# sourceMappingURL=logger.js.map