import { createServer, IncomingMessage, ServerResponse } from 'http';
import { Logger } from './logger.js';
import { EvolutionEngine } from './evolution-engine.js';
import { AgentManager } from './agent-manager.js';
import { EvoSystem } from './system.js';

interface PrometheusMetrics {
  // Counters
  evo_cycles_total: number;
  evo_successful_cycles_total: number;
  evo_failed_cycles_total: number;
  evo_applied_improvements_total: number;
  evo_rollbacks_total: number;
  evo_agents_spawned_total: number;
  evo_agents_stopped_total: number;

  // Gauges
  evo_level: number;
  evo_success_rate_percent: number;
  evo_avg_cycle_time_ms: number;
  evo_memory_rss_bytes: number;
  evo_memory_heap_used_bytes: number;
  evo_agents_active: number;
  evo_backup_count: number;

  // Histograms (as summary)
  evo_cycle_duration_ms: number;
}

/**
 * Prometheus metrics HTTP endpoint for monitoring integration
 */
export class MetricsServer {
  private server: any;
  private logger: Logger;
  private port: number;
  private system: EvoSystem;
  private interval?: NodeJS.Timeout;

  constructor(logger: Logger, system: EvoSystem, port: number = 9090) {
    this.logger = logger;
    this.system = system;
    this.port = port;
  }

  start(): void {
    if (this.server) {
      this.logger.warn('Metrics server already running');
      return;
    }

    this.server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      if (req.url === '/metrics') {
        try {
          const metrics = await this.collectMetrics();
          const body = this.formatPrometheus(metrics);
          res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
          res.end(body);
        } catch (error: any) {
          this.logger.error('Failed to collect metrics:', error.message);
          res.writeHead(500);
          res.end(`# Error: ${error.message}\n`);
        }
      } else if (req.url === '/health') {
        res.writeHead(200);
        res.end('OK\n');
      } else {
        res.writeHead(404);
        res.end('Not found\n');
      }
    });

    this.server.listen(this.port, () => {
      this.logger.info(`📊 Metrics server started on http://localhost:${this.port}/metrics`);
    });

    // Also start periodic collection for internal tracking (optional)
    this.interval = setInterval(() => {
      // Could trigger garbage collection or other maintenance
    }, 60000);
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.logger.info('📊 Metrics server stopped');
          resolve();
        });
      } else {
        resolve();
      }
      if (this.interval) {
        clearInterval(this.interval);
      }
    });
  }

  private async collectMetrics(): Promise<PrometheusMetrics> {
    const mem = process.memoryUsage();
    const engine = this.system.getEvolutionEngine();
    const agentManager = this.system.getAgentManager();

    // Fetch metrics once to avoid multiple awaits
    const engineMetrics = engine ? await engine.getMetrics() : undefined;

    const metrics: PrometheusMetrics = {
      // Counters
      evo_cycles_total: engineMetrics?.totalCycles || 0,
      evo_successful_cycles_total: engineMetrics?.successfulCycles || 0,
      evo_failed_cycles_total: engineMetrics?.failedCycles || 0,
      // Approximate: count applied improvements from history
      evo_applied_improvements_total: engine ? (await engine.getHistory()).filter(h => h.applied).length : 0,
      evo_rollbacks_total: 0, // TODO: track rollbacks separately
      evo_agents_spawned_total: agentManager ? agentManager.listAgents().length : 0,
      evo_agents_stopped_total: 0, // TODO: track

      // Gauges
      evo_level: engine?.getLevel() || 0,
      evo_success_rate_percent: engineMetrics?.successRate || 0,
      evo_avg_cycle_time_ms: engineMetrics?.avgCycleTimeMs || 0,
      evo_memory_rss_bytes: mem.rss,
      evo_memory_heap_used_bytes: mem.heapUsed,
      evo_agents_active: agentManager ? agentManager.listAgents().length : 0,
      evo_backup_count: 0, // TODO: count backup files

      // Histogram
      evo_cycle_duration_ms: engineMetrics?.lastCycleTimeMs || 0,
    };

    return metrics;
  }

  private formatPrometheus(metrics: PrometheusMetrics): string {
    const lines: string[] = [];

    // Counters
    lines.push(`# TYPE evo_cycles_total counter`);
    lines.push(`evo_cycles_total ${metrics.evo_cycles_total}`);
    lines.push(`# TYPE evo_successful_cycles_total counter`);
    lines.push(`evo_successful_cycles_total ${metrics.evo_successful_cycles_total}`);
    lines.push(`# TYPE evo_failed_cycles_total counter`);
    lines.push(`evo_failed_cycles_total ${metrics.evo_failed_cycles_total}`);
    lines.push(`# TYPE evo_applied_improvements_total counter`);
    lines.push(`evo_applied_improvements_total ${metrics.evo_applied_improvements_total}`);
    lines.push(`# TYPE evo_agents_spawned_total counter`);
    lines.push(`evo_agents_spawned_total ${metrics.evo_agents_spawned_total}`);

    // Gauges
    lines.push(`# TYPE evo_level gauge`);
    lines.push(`evo_level ${metrics.evo_level}`);
    lines.push(`# TYPE evo_success_rate_percent gauge`);
    lines.push(`evo_success_rate_percent ${metrics.evo_success_rate_percent}`);
    lines.push(`# TYPE evo_avg_cycle_time_ms gauge`);
    lines.push(`evo_avg_cycle_time_ms ${metrics.evo_avg_cycle_time_ms}`);
    lines.push(`# TYPE evo_memory_rss_bytes gauge`);
    lines.push(`evo_memory_rss_bytes ${metrics.evo_memory_rss_bytes}`);
    lines.push(`# TYPE evo_memory_heap_used_bytes gauge`);
    lines.push(`evo_memory_heap_used_bytes ${metrics.evo_memory_heap_used_bytes}`);
    lines.push(`# TYPE evo_agents_active gauge`);
    lines.push(`evo_agents_active ${metrics.evo_agents_active}`);

    // Histogram (as gauge for simplicity)
    lines.push(`# TYPE evo_cycle_duration_ms gauge`);
    lines.push(`evo_cycle_duration_ms ${metrics.evo_cycle_duration_ms}`);

    return lines.join('\n') + '\n';
  }
}
