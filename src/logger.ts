import * as fs from 'fs';
import * as path from 'path';

interface LogConfig {
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
}

export class Logger {
  private logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  private logPath: string;
  private buffer: string[] = [];

  constructor(config: LogConfig, logPath?: string) {
    this.logLevel = config.logLevel || 'info';
    this.logPath = logPath || path.join(process.env.HOME || process.env.USERPROFILE || '', '.pi', 'agent', 'evo.log');
    this.ensureLogDir();
  }

  private ensureLogDir(): void {
    const dir = path.dirname(this.logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private shouldLog(level: string): boolean {
    const levels: Record<string, number> = { trace: 0, debug: 1, info: 2, warn: 2, error: 0 };
    return levels[level] <= levels[this.logLevel];
  }

  private format(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  private write(entry: string): void {
    console.log(entry);
    this.buffer.push(entry);
    if (this.buffer.length >= 50) this.flush();
  }

  flush(): void {
    if (this.buffer.length > 0) {
      try {
        fs.appendFileSync(this.logPath, this.buffer.join('\n') + '\n');
      } catch {
        // ignore write errors
      }
      this.buffer = [];
    }
  }

  trace(msg: string): void { if (this.shouldLog('trace')) this.write(this.format('TRACE', msg)); }
  debug(msg: string): void { if (this.shouldLog('debug')) this.write(this.format('DEBUG', msg)); }
  info(msg: string): void  { if (this.shouldLog('info'))  this.write(this.format('INFO',  msg)); }
  warn(msg: string, err?: unknown): void  { if (this.shouldLog('warn')) { const errorMsg = err instanceof Error ? err.message : String(err); this.write(this.format('WARN', msg + (errorMsg ? `: ${errorMsg}` : ''))); } }
  error(msg: string, err?: unknown): void {
    const errorMsg = err instanceof Error ? err.message : String(err);
    this.write(this.format('ERROR', msg + (errorMsg ? `: ${errorMsg}` : '')));
  }

  setLogLevel(level: 'trace' | 'debug' | 'info' | 'warn' | 'error'): void {
    this.logLevel = level;
    this.info(`Log level set to ${level}`);
  }
}
