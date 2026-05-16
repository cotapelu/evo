#!/usr/bin/env node

/**
 * main.ts - Evo Agent Entry Point (Simplified)
 * Minimal bootstrap for self-evolving agent system
 */

import { EvoSystem } from './system.js';
import { getAgentDir } from '@earendil-works/pi-coding-agent';
import { readFile, access, constants, mkdir } from 'fs/promises';
import { join } from 'path';

const VERSION = '2.2.0';

// ─── Simple Logging ────────────────────────────────────────────────────────────

async function ensureLogging(): Promise<string> {
  const agentDir = getAgentDir();
  const logFile = join(agentDir, 'evo.log');
  await mkdir(agentDir, { recursive: true }).catch(() => {});
  return logFile;
}

function log(msg: string): void {
  console.error(`[Evo] ${msg}`);
}

// ─── Minimal Pre-flight ───────────────────────────────────────────────────────

async function simplePreFlight(): Promise<{agentDir: string; model: string}> {
  const agentDir = getAgentDir();
  const settingsPath = join(agentDir, 'settings.json');

  // Check settings.json exists
  try {
    await access(settingsPath, constants.R_OK);
    const raw = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(raw);
    const model = settings.defaultModel || '';
    log(`✓ Settings loaded. Model: ${model || 'not set'}`);
    return { agentDir, model };
  } catch {
    log('✗ settings.json not found at ' + settingsPath);
    throw new Error('Create settings.json in ' + agentDir);
  }
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

let shutdownInProgress = false;

async function shutdown(): Promise<void> {
  if (shutdownInProgress) return;
  shutdownInProgress = true;
  log('Shutting down...');
  try {
    await EvoSystem.getInstance().shutdown();
    log('Shutdown complete');
  } catch (e: any) {
    log('Shutdown error: ' + e.message);
  } finally {
    process.exit(0);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n🧬 Evo Agent v${VERSION}\n`);

  try {
    // Pre-flight
    log('Checking configuration...');
    const { agentDir, model } = await simplePreFlight();
    await ensureLogging();

    // Initialize system
    log('Initializing...');
    await EvoSystem.getInstance().initialize();

    log('Ready. Starting Interactive Mode...');
    await EvoSystem.getInstance().run('interactive');
  } catch (e: any) {
    log('Fatal: ' + e.message);
    await shutdown();
  }
}

// ─── Signal Handlers ──────────────────────────────────────────────────────────

process.on('SIGINT',  ()    => shutdown());
process.on('SIGTERM', ()    => shutdown());
process.on('uncaughtException', async (error: Error) => {
  log('Uncaught: ' + error.message);
  await shutdown();
});
process.on('unhandledRejection', async (reason: any) => {
  log('Unhandled rejection: ' + reason);
  await shutdown();
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────

await main().catch(async (e: any) => {
  log('Fatal: ' + e.message);
  await shutdown();
});
