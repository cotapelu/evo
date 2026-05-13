// __tests__/health.test.ts - Unit tests for Health Monitor

import { HealthMonitor } from '../health.js';

describe('HealthMonitor', () => {
  let hm: HealthMonitor;
  const limits = { maxMemoryMB: 100, maxCpuMsPerIter: 5000, maxOpenFiles: 100 };

  beforeEach(() => {
    hm = new HealthMonitor(limits);
  });

  test('should start healthy', () => {
    const status = hm.getStatus();
    expect(status.status).toBe('healthy');
    expect(status.consecutiveFailures).toBe(0);
    expect(status.memoryPressure).toBe(0);
  });

  test('should detect high memory pressure', async () => {
    const status = await hm.performCheck(85, 1000, 120); // 85% memory
    expect(status.status).toBe('degraded');
    expect(status.issues).toContain('High memory usage');
  });

  test('should detect critical memory pressure', async () => {
    const status = await hm.performCheck(95, 1000, 120); // 95% memory
    expect(status.status).toBe('unhealthy');
    expect(status.issues).toContain('Critical memory pressure');
  });

  test('should detect high CPU usage', async () => {
    const status = await hm.performCheck(30, 6000, 120); // 120% of limit
    expect(status.status).toBe('degraded');
    expect(status.issues).toContain('High CPU time per iteration');
  });

  test('should track consecutive failures', async () => {
    await hm.performCheck(95, 6000, 30); // unhealthy
    expect(hm.getStatus().consecutiveFailures).toBe(1);

    await hm.performCheck(95, 6000, 30); // another unhealthy
    expect(hm.getStatus().consecutiveFailures).toBe(2);
  });

  test('should reset failures when healthy', async () => {
    await hm.performCheck(95, 6000, 30); // unhealthy
    expect(hm.getStatus().consecutiveFailures).toBe(1);

    await hm.performCheck(30, 1000, 120); // healthy
    expect(hm.getStatus().consecutiveFailures).toBe(0);
  });

  test('should trigger auto-recovery after threshold', async () => {
    let triggered = false;
    const recoveryTriggered = async () => { triggered = true; };
    hm.registerRecoveryAction(recoveryTriggered);

    // Cause multiple failures
    for (let i = 0; i < 3; i++) {
      await hm.performCheck(95, 6000, 30);
    }

    expect(triggered).toBe(true);
  });

  test('should update limits dynamically', async () => {
    hm.updateLimits({ maxMemoryMB: 200 });
    const status = await hm.performCheck(150, 1000, 120); // 75% of new limit

    expect(status.memoryPressure).toBe(0.75);
    expect(status.status).toBe('degraded'); // still high but not critical
  });

  test('should calculate health metrics correctly', async () => {
    const status = await hm.performCheck(50, 2500, 3600);

    expect(status.memoryPressure).toBe(0.5);
    expect(status.cpuLoad).toBe(0.5); // 2500/5000 = 0.5
    expect(status.uptime).toBe(3600);
    expect(status.lastCheck).toBeDefined();
  });

  test('should report healthy when within limits', async () => {
    const status = await hm.performCheck(40, 2000, 600);
    expect(status.status).toBe('healthy');
    expect(status.issues).toHaveLength(0);
  });

  test('should correctly identify degraded vs unhealthy', async () => {
    const degraded = await hm.performCheck(80, 4000, 300); // 80% mem, 80% CPU
    expect(degraded.status).toBe('degraded');

    const unhealthy = await hm.performCheck(95, 6000, 30); // critical mem
    expect(unhealthy.status).toBe('unhealthy');
  });
});
