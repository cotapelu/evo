import * as fs from 'fs';
import * as path from 'path';

export class Logger {
  private logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  private logPath: string;
  private buffer: string[] = [];

  constructor(config: any, logPath?: string) {
    this.logLevel = config.logLevel || 'info';
    this.logPath = logPath || config.logPath || 'evo.log';
    this.ensureLogDir();
  }

  private ensureLogDir() {
    const dir = path.dirname(this.logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private shouldLog(level: string): boolean {
    const levels = { trace: 0, debug: 1, info: 2, warn: 2, error: 0 };
    return levels[level as keyof typeof levels] <= levels[this.logLevel];
  }

  private format(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${meta ? ' ' + JSON.stringify(meta) : ''}`;
  }

  private write(entry: string) {
    console.log(entry);
    this.buffer.push(entry);
    if (this.buffer.length >= 100) this.flush();
  }

  flush() {
    if (this.buffer.length > 0) {
      fs.appendFileSync(this.logPath, this.buffer.join('\n') + '\n');
      this.buffer = [];
    }
  }

  trace(msg: string, meta?: any) { if (this.shouldLog('trace')) this.write(this.format('TRACE', msg, meta)); }
  debug(msg: string, meta?: any) { if (this.shouldLog('debug')) this.write(this.format('DEBUG', msg, meta)); }
  info(msg: string, meta?: any) { if (this.shouldLog('info')) this.write(this.format('INFO', msg, meta)); }
  warn(msg: string, meta?: any) { if (this.shouldLog('warn')) this.write(this.format('WARN', msg, meta)); }
  error(msg: string, err?: any) { this.write(this.format('ERROR', msg, err ? { error: err.message || err } : undefined)); }
}
