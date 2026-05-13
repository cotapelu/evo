// health.ts - Health Monitoring and Auto-Recovery System
// Monitors agent health, detects issues, and triggers recovery

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: string;
  consecutiveFailures: number;
  memoryPressure: number;
  cpuLoad: number;
  uptime: number;
  issues: string[];
}

export interface ResourceLimits {
  maxMemoryMB: number;
  maxCpuMsPerIter: number;
  maxOpenFiles: number;
}

export class HealthMonitor {
  private status: HealthStatus;
  private limits: ResourceLimits;
  private checkInterval: number;
  private failureThreshold: number;
  private recoveryActions: (() => Promise<void>)[] = [];

  constructor(limits: ResourceLimits, options?: { checkInterval?: number; failureThreshold?: number }) {
    this.limits = limits;
    this.checkInterval = options?.checkInterval ?? 5000; // 5 seconds
    this.failureThreshold = options?.failureThreshold ?? 3;
    this.status = {
      status: 'healthy',
      lastCheck: new Date().toISOString(),
      consecutiveFailures: 0,
      memoryPressure: 0,
      cpuLoad: 0,
      uptime: 0,
      issues: []
    };
  }

  updateLimits(limits: Partial<ResourceLimits>): void {
    this.limits = { ...this.limits, ...limits };
  }

  async performCheck(currentMemoryMB: number, currentCpuMs: number, uptimeSec: number): Promise<HealthStatus> {
    const issues: string[] = [];
    const memPressure = currentMemoryMB / this.limits.maxMemoryMB;

    if (memPressure > 0.9) {
      issues.push('Critical memory pressure');
    } else if (memPressure > 0.7) {
      issues.push('High memory usage');
    }

    if (currentCpuMs > this.limits.maxCpuMsPerIter) {
      issues.push('High CPU time per iteration');
    }

    if (uptimeSec < 60 && this.status.consecutiveFailures > 0) {
      issues.push('Early failures after restart');
    }

    const status: HealthStatus = {
      status: issues.length === 0 ? 'healthy' :
              issues.some(i => i.includes('Critical')) ? 'unhealthy' : 'degraded',
      lastCheck: new Date().toISOString(),
      consecutiveFailures: this.status.consecutiveFailures,
      memoryPressure: Math.round(memPressure * 100) / 100,
      cpuLoad: Math.round((currentCpuMs / (this.limits.maxCpuMsPerIter || 1)) * 100) / 100,
      uptime: uptimeSec,
      issues
    };

    this.updateStatus(status);
    return status;
  }

  private updateStatus(newStatus: HealthStatus): void {
    const oldStatus = this.status.status;
    this.status = newStatus;

    if (oldStatus !== newStatus.status) {
      this.onStatusChange(oldStatus, newStatus.status);
    }

    if (newStatus.status === 'unhealthy') {
      this.status.consecutiveFailures++;
      if (this.status.consecutiveFailures >= this.failureThreshold) {
        this.triggerAutoRecovery();
      }
    } else {
      this.status.consecutiveFailures = 0;
    }
  }

  private onStatusChange(old: string, current: string): void {
    // Hook for logging
    const level = current === 'healthy' ? 'info' : current === 'degraded' ? 'warn' : 'error';
    console.log(`[HealthMonitor] Status changed: ${old} → ${current}`, this.status.issues);
  }

  registerRecoveryAction(action: () => Promise<void>): void {
    this.recoveryActions.push(action);
  }

  private async triggerAutoRecovery(): Promise<void> {
    console.log('[HealthMonitor] 🚨 Triggering auto-recovery...');

    try {
      for (const action of this.recoveryActions) {
        await action();
      }
    } catch (error) {
      console.error('[HealthMonitor] Recovery action failed:', error);
    }

    // Reset some state after recovery
    this.status.consecutiveFailures = Math.max(0, this.status.consecutiveFailures - 1);
    this.status.lastCheck = new Date().toISOString();

    console.log('[HealthMonitor] ✅ Auto-recovery completed');
  }

  getStatus(): HealthStatus {
    return { ...this.status };
  }

  isHealthy(): boolean {
    return this.status.status === 'healthy';
  }

  // Common recovery actions
  static createDefaultRecoveryActions(
    clearCacheFn: () => void,
    gcFn: () => void,
    saveStateFn: () => Promise<void>,
    reduceLimitsFn: () => void
  ): (() => Promise<void>)[] {
    return [
      async () => {
        console.log('[Recovery] Clearing temporary caches...');
        clearCacheFn();
      },
      async () => {
        console.log('[Recovery] Triggering garbage collection...');
        gcFn();
      },
      async () => {
        console.log('[Recovery] Saving state checkpoint...');
        await saveStateFn();
      },
      async () => {
        console.log('[Recovery] Reducing resource limits...');
        reduceLimitsFn();
      }
    ];
  }
}
