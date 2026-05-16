import * as fs from 'fs';
import * as path from 'path';
import { stat, rename, readdir, unlink } from 'fs/promises';

const LOG_MAX_SIZE_MB = 50;
const LOG_KEEP_COUNT  = 5;

/**
 * Logger with file rotation.
 *
 * Writes timestamped lines to console + an internal buffer.
 * flush() appends the buffer to the log file and, if the file exceeds
 * LOG_MAX_SIZE_MB, rotates it (evo.log.1, evo.log.2, …) keeping at most
 * LOG_KEEP_COUNT old files.
 */
export class Logger {
  private logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  private logPath: string;
  private buffer: string[] = [];

  constructor(config: any, logPath?: string) {
    this.logLevel = config.logLevel || 'info';
    // Always default to agentDir/evo.log (pi convention)
    this.logPath = logPath || config.logPath || path.join(process.env.HOME || process.env.USERPROFILE || '', '.pi', 'agent', 'evo.log');
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
    // Attempt rotation — fire-and-forget, don't block
    this.maybeRotate().catch(() => {});
  }

  /** Rotate log file if it exceeds LOG_MAX_SIZE_MB. Keeps LOG_KEEP_COUNT old files. */
  private async maybeRotate(): Promise<void> {
    try {
      const st = await stat(this.logPath).catch(() => null as any);
      if (!st || st.size < LOG_MAX_SIZE_MB * 1024 * 1024) return;

      const dir  = path.dirname(this.logPath);
      const base = path.basename(this.logPath);
      let   maxN = 0;

      // Find highest existing .N suffix
      try {
        const entries = await readdir(dir);
        for (const name of entries) {
          const m = name.match(new RegExp('^' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.(\\d+)$'));
          if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
        }
      } catch { /* ignore */ }

      // Rotate current file → .N+1
      await rename(this.logPath, this.logPath + '.' + (maxN + 1));

      // Prune: keep only LOG_KEEP_COUNT newest
      const all = await readdir(dir).catch(() => []);
      const logFiles = all.filter(n => n === base || new RegExp('^' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.\\d+$').test(n));
      const withTime = await Promise.all(
        logFiles.map(async f => ({
          name:  f,
          path:  path.join(dir, f),
          mtime: (await stat(path.join(dir, f)).catch(() => new Date(0)) as any).mtime,
        }))
      );
      withTime.sort((a: any, b: any) => (a.mtime as any).getTime() - (b.mtime as any).getTime());
      while (withTime.length > LOG_KEEP_COUNT) {
        const oldest = withTime.shift();
        if (oldest) await unlink((oldest as any).path).catch(() => {});
      }
    } catch { /* rotation is best-effort, never throw */ }
  }

  trace(msg: string, meta?: any) { if (this.shouldLog('trace')) this.write(this.format('TRACE', msg, meta)); }
  debug(msg: string, meta?: any) { if (this.shouldLog('debug')) this.write(this.format('DEBUG', msg, meta)); }
  info(msg: string, meta?: any)  { if (this.shouldLog('info'))  this.write(this.format('INFO',  msg, meta)); }
  warn(msg: string, meta?: any)  { if (this.shouldLog('warn'))  this.write(this.format('WARN',  msg, meta)); }
  error(msg: string, err?: any)  { this.write(this.format('ERROR', msg, err ? { error: err.message || err } : undefined)); }
}
