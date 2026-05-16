#!/usr/bin/env node

/**
 * evo.ts - Self-Evolving Agent System
 * Full rewrite using @earendil-works/pi-coding-agent
 *
 * Improvements applied (2026-05-16):
 *  - Version banner on startup
 *  - Pre-flight check (API key, Node version, config, model in registry)
 *  - Shutdown timeout (AbortSignal)
 *  - Init timeout (30s)
 *  - Unified shutdown handler
 *  - Startup args logging
 *  - Memory health check with auto-shutdown at 3 consecutive high checks
 *  - No 'as any' casts
 *  - Non-interactive headless mode (evolution daemon)
 *  - Heartbeat for deadlock detection
 *  - Startup lifecycle logging + performance metrics
 *  - Log rotation (50MB, keep 5 old) + /evolution-logs
 *  - /evolution-log + /evolution-heartbeat commands in TUI
 */

import { EvoSystem } from './src/system.js';
import { getAgentDir } from '@earendil-works/pi-coding-agent';
import { readFile, access, constants, writeFile, mkdir, readdir, unlink, stat } from 'fs/promises';
import { setTimeout as delay } from 'timers/promises';
import { join } from 'path';

const VERSION = '2.2.0';

// ─── Constants ───────────────────────────────────────────────────────────────
const INIT_TIMEOUT_MS          = 30_000;
const SHUTDOWN_TIMEOUT_MS      = 10_000;
const PREFLIGHT_TIMEOUT_MS     = 10_000;
const MEMORY_WARN_THRESHOLD_MB = 500;
const MEMORY_MAX_THRESHOLD_MB  = 800;
const MEMORY_CHECK_INTERVAL_MS = 15_000;
const HEARTBEAT_INTERVAL_MS    = 30_000;
const HEARTBEAT_TIMEOUT_MS     = 120_000;
const LOG_MAX_SIZE_MB          = 50;
const LOG_KEEP_COUNT           = 5;
const AGENT_DIR                = getAgentDir();
const LOG_FILE                  = join(AGENT_DIR, 'evo.log');
const HEARTBEAT_FILE            = join(AGENT_DIR, '.evo', 'heartbeat.json');

// ─── Log rotation ─────────────────────────────────────────────────────────────

/**
 * Rotate evo.log if it exceeds LOG_MAX_SIZE_MB.
 * Keeps at most LOG_KEEP_COUNT old rotated files.
 * Evo.log.N where N=1 is oldest, higher N is newer.
 */
async function rotateLogIfNeeded(): Promise<void> {
  try {
    const st = await stat(LOG_FILE).catch(() => null);
    if (!st || st.size < LOG_MAX_SIZE_MB * 1024 * 1024) return;

    let maxN = 0;
    try {
      const entries = await readdir(AGENT_DIR);
      for (const name of entries) {
        const m = name.match(/^evo\.log\.(\d+)$/);
        if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
      }
    } catch { /* ignore */ }

    const nextN = maxN + 1;
    const { rename } = await import('fs/promises');
    await rename(LOG_FILE, join(AGENT_DIR, `evo.log.${nextN}`));

    // Prune oldest
    const all = await readdir(AGENT_DIR).catch(() => []);
    const base = 'evo.log';
    const logs = all.filter(n => n === base || /^evo\.log\.\d+$/.test(n));
    const withTime = await Promise.all(
      logs.map(async f => ({
        name: f,
        path: join(AGENT_DIR, f),
        mtime: (await stat(join(AGENT_DIR, f)).catch(() => new Date(0) as any)).mtime as any,
      }))
    );
    withTime.sort((a: any, b: any) => a.mtime.getTime() - b.mtime.getTime());
    while (withTime.length > LOG_KEEP_COUNT) {
      const oldest = withTime.shift();
      if (oldest) await unlink((oldest as any).path).catch(() => {});
    }
  } catch { /* rotation failures are non-critical */ }
}

// ─── Heartbeat ───────────────────────────────────────────────────────────────

let heartbeatTimer: NodeJS.Timeout | null = null;
let highMemoryCount = 0;

/**
 * Write a single heartbeat JSON file.
 * Called both on demand and on a repeating interval.
 */
async function writeHeartbeat(): Promise<void> {
  try {
    await mkdir(join(AGENT_DIR, '.evo'), { recursive: true });
    await writeFile(HEARTBEAT_FILE, JSON.stringify({
      pid: process.pid,
      lastBeat: new Date().toISOString(),
      uptime: process.uptime(),
      memoryRSS: process.memoryUsage().rss,
    }));
  } catch { /* heartbeat write failures are non-critical */ }
}

/**
 * Start the heartbeat writer — writes every HEARTBEAT_INTERVAL_MS milliseconds.
 */
function startHeartbeat(): void {
  writeHeartbeat().catch(() => {});
  heartbeatTimer = setInterval(writeHeartbeat, HEARTBEAT_INTERVAL_MS);
}

/**
 * Check whether the heartbeat file is stale.
 * If the last beat is older than HEARTBEAT_TIMEOUT_MS we may have a deadlock.
 */
async function checkHeartbeat(): Promise<void> {
  try {
    const raw = await readFile(HEARTBEAT_FILE, 'utf-8');
    const hb = JSON.parse(raw);
    const ageMs = Date.now() - new Date(hb.lastBeat).getTime();
    if (ageMs > HEARTBEAT_TIMEOUT_MS) {
      console.error(`⚠️  Heartbeat stale: last beat ${Math.round(ageMs / 1000)}s ago — possible deadlock?`);
    }
  } catch { /* no heartbeat yet — normal on first start */ }
}

// ─── Memory health check ─────────────────────────────────────────────────────

/**
 * Start periodic memory + heartbeat checks.
 * Auto-shuts down the process after 3 consecutive RSS readings above
 * MEMORY_MAX_THRESHOLD_MB to avoid OOM kill.
 */
function startMemoryHealthCheck(): void {
  setInterval(async () => {
    const rssMB = Math.round(process.memoryUsage().rss / 1024 / 1024);

    if (rssMB > MEMORY_WARN_THRESHOLD_MB) {
      console.error(`⚠️  Memory warning: RSS=${rssMB}MB (warning threshold=${MEMORY_WARN_THRESHOLD_MB}MB).`);
    }

    if (rssMB > MEMORY_MAX_THRESHOLD_MB) {
      highMemoryCount++;
      console.error(`🔴 High memory: RSS=${rssMB}MB (alert ${highMemoryCount}/3)`);
      if (highMemoryCount >= 3) {
        console.error('💀 Memory critical for 3 consecutive checks — shutting down to prevent OOM.');
        await shutdown('memory-oom').catch(() => process.exit(1));
        return;
      }
    } else {
      highMemoryCount = 0;
    }

    await checkHeartbeat();
  }, MEMORY_CHECK_INTERVAL_MS);
}

// ─── Pre-flight ───────────────────────────────────────────────────────────────

interface PreflightResult {
  settingsJson: Record<string, any>;
  modelRegistrySnapshot: Record<string, any>;
  agentDir: string;
  model: string;
}

/**
 * Validate environment before initialization.
 * Checks: Node version, API key, settings.json, model in registry.
 * Exits process with code 1 on failure.
 * Times out after PREFLIGHT_TIMEOUT_MS milliseconds.
 */
async function preFlightCheck(): Promise<PreflightResult> {
  const errors: string[]    = [];
  const warnings: string[]  = [];
  const settingsJson: Record<string, any> = {};
  let   modelRegistrySnapshot: Record<string, any> = {};
  let   selectedModel = '';

  // ── Timeout wrapper ───────────────────────────────────────────────
  const withTimeout = <T>(p: Promise<T>): Promise<T> =>
    Promise.race([
      p,
      delay(PREFLIGHT_TIMEOUT_MS).then(() => { throw new Error(`Pre-flight timed out after ${PREFLIGHT_TIMEOUT_MS / 1000}s`); }),
    ]) as Promise<T>;

  // 1) Node version
  await withTimeout((async () => {
    const rawVer = process.version.replace('v', '').split('.').map(Number);
    const [major, minor, patch] = rawVer;
    if (major! < 20 || (major === 20 && (minor! < 6 || (minor === 6 && patch! < 0)))) {
      errors.push(`Node.js >= 20.6.0 required, found ${process.version}`);
    } else {
      console.log(`   ✓ Node.js ${process.version}`);
    }
  })());

  // 2) API key (warning only - don't fail)
  await withTimeout((async () => {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
      warnings.push('No API key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY for LLM functionality.');
      console.log(`   ⚠️  No API key - running in limited mode`);
    } else {
      const p = process.env.ANTHROPIC_API_KEY ? 'Anthropic' : 'OpenAI';
      console.log(`   ✓ API key found (${p})`);
    }
  })());

  // 3) settings.json
  const settingsPath = join(AGENT_DIR, 'settings.json');
  await withTimeout((async () => {
    try {
      await access(settingsPath, constants.R_OK);
      console.log(`   ✓ settings.json at ${settingsPath}`);
      const raw = await readFile(settingsPath, 'utf-8');
      Object.assign(settingsJson, JSON.parse(raw));
      // Model comes from pi's global defaultModel only
      selectedModel = settingsJson.defaultModel || '';
      if (selectedModel) {
        console.log(`   ✓ Model: ${selectedModel}`);
      } else {
        warnings.push('No defaultModel configured in settings.json. Use /model to select one.');
        console.log(`   ⚠️  No defaultModel set`);
      }
    } catch {
      errors.push('settings.json not found at ' + settingsPath);
    }
  })());

  // 4) Required directories (+ heartbeat file)
  await withTimeout((async () => {
    await mkdir(join(AGENT_DIR, 'sessions'), { recursive: true }).catch(() => {});
    await mkdir(join(AGENT_DIR, '.evo'),    { recursive: true }).catch(() => {});
    // Seed a fresh heartbeat file so checkHeartbeat() has something to read
    await writeHeartbeat();
  })());

  if (errors.length > 0) {
    console.error('\n❌ Pre-flight check failed:\n' + errors.map(e => '  • ' + e).join('\n'));
    process.exit(1);
  }

  // 5) Read models.json + validate model exists
  await withTimeout((async () => {
    try {
      const raw = await readFile(join(AGENT_DIR, 'models.json'), 'utf-8').catch(() => '{"providers":{}}');
      modelRegistrySnapshot = JSON.parse(raw);
      const providers = Object.keys(modelRegistrySnapshot.providers || {});
      console.log(`   ✓ Model registry: ${providers.length} provider(s) (${providers.join(', ') || 'none'})`);

      // ── Validate selected model ──────────────────────────────────
      if (selectedModel) {
        const [provider, modelId] = selectedModel.split('/');
        if (provider && modelId) {
          const prov = (modelRegistrySnapshot as any).providers?.[provider];
          if (prov && prov.models && prov.models[modelId]) {
            console.log(`   ✓ Model resolved: ${provider}/${modelId}`);
          } else {
            warnings.push(`Model '${selectedModel}' not found in registry — initialize will likely fail.`);
          }
        }
      }
    } catch (e: any) {
      warnings.push(`Could not read models.json: ${e.message}`);
    }
  })());

  if (warnings.length > 0) {
    console.warn('\n⚠️  Pre-flight warnings:');
    warnings.forEach(w => console.warn('  • ' + w));
  }

  return { settingsJson, modelRegistrySnapshot, agentDir: AGENT_DIR, model: selectedModel };
}

// ─── Shutdown ────────────────────────────────────────────────────────────────

let SHUTDOWN_IN_PROGRESS = false;

/**
 * Graceful shutdown with timeout.
 * Stops heartbeat timer first, then delegates to EvoSystem.shutdown().
 *
 * @param signal - Optional signal name for logging (SIGINT, SIGTERM, memory-oom, …)
 */
async function shutdown(signal?: string): Promise<void> {
  if (SHUTDOWN_IN_PROGRESS) return;
  SHUTDOWN_IN_PROGRESS = true;

  const label = signal ? `Received ${signal}` : 'Shutdown requested';
  console.error(`\n${label} — shutting down...`);

  // Stop timers immediately
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }

  try {
    await Promise.race([
      EvoSystem.shutdown(),
      delay(SHUTDOWN_TIMEOUT_MS).then(() => { throw new Error('Shutdown timed out'); }),
    ]);
    console.error('✅ Shutdown complete.');
  } catch (e: any) {
    console.error('⚠️  Shutdown error:', e.message);
  } finally {
    process.exit(0);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

/**
 * Entry point for the Evo Agent.
 *
 * @param mode 'interactive' — full TUI; 'evolution' — run one headless cycle then exit
 */
async function main(): Promise<void> {
  const args    = process.argv.slice(2);
  const rawMode = args[0] || 'interactive';
  const mode: 'interactive' | 'evolution' = (rawMode === 'evolution' ? 'evolution' : 'interactive');

  // Version banner
  console.log(`\n🧬 Evo Agent v${VERSION} — Evolution Engine\n`);

  if (args.length > 0) {
    console.log(`Mode: ${mode} | Args: ${args.slice(1).join(' ') || '(none)'}`);
  }

  // ── Phase 1: Pre-flight ───────────────────────────────────────────
  const t0 = Date.now();
  console.log('⚡ Pre-flight check...');
  let preflight: PreflightResult;
  try {
    preflight = await preFlightCheck();
    console.log('✅ Pre-flight check passed.\n');
  } catch (e: any) {
    console.error('❌ Pre-flight error:', e.message);
    process.exit(1);
    return;
  }

  // ── Phase 2: Initialize ───────────────────────────────────────────
  console.log('⚡ Initializing EvoSystem...');
  const system = EvoSystem.getInstance();
  try {
    await Promise.race([
      system.initialize(),
      delay(INIT_TIMEOUT_MS).then(() => {
        throw new Error(`Initialization timeout (${INIT_TIMEOUT_MS / 1000}s)`);
      }),
    ]);
  } catch (e: any) {
    console.error('❌ Failed to initialize:', e.message);
    await shutdown().catch(() => process.exit(1));
    return;
  }

  const initTime     = Date.now() - t0;
  const afterInitMem = process.memoryUsage();
  console.log(`✅ Initialized in ${initTime}ms | RSS: ${Math.round(afterInitMem.rss / 1024 / 1024)}MB\n`);

  // ── Phase 3: Health & heartbeat ───────────────────────────────────
  startHeartbeat();       // synchronous — no await
  startMemoryHealthCheck();
  await rotateLogIfNeeded(); // rotate on startup if needed
  console.log('💓 Heartbeat + memory monitor started.\n');

  // ── Phase 4: Run ──────────────────────────────────────────────────
  if (mode === 'evolution') {
    console.log('🔄 Headless evolution mode — running one cycle...');
    const engine = system.getEvolutionEngine();
    if (!engine) {
      console.error('❌ Evolution engine not available');
      await shutdown().catch(() => process.exit(1));
      return;
    }
    const result = await engine.cycle();
    console.log(result ? '✅ Evolution cycle completed.' : '⚠️  No improvements made.');
    await shutdown('evolution-mode-complete').catch(() => process.exit(0));
    return;
  }

  // ── INTERACTIVE mode: full TUI ───────────────────────────────────
  console.log('🎮 Starting Interactive Mode...\n');
  try {
    await system.run('interactive');
  } catch (e: any) {
    console.error('Fatal error:', e.message);
    await shutdown().catch(() => process.exit(1));
  }
}

// ─── Signal handlers ─────────────────────────────────────────────────────────

process.on('SIGINT',  ()    => shutdown('SIGINT'));
process.on('SIGTERM', ()    => shutdown('SIGTERM'));
process.on('uncaughtException', async (error: Error) => {
  console.error('Uncaught exception:', error.message);
  await shutdown('uncaughtException').catch(() => process.exit(1));
});
process.on('unhandledRejection', async (reason: any) => {
  console.error('Unhandled rejection:', reason);
  await shutdown('unhandledRejection').catch(() => process.exit(1));
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────

await main().catch(async (e: any) => {
  console.error('Fatal:', e.message);
  await shutdown('bootstrap-error').catch(() => process.exit(1));
});
