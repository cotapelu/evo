#!/usr/bin/env node

/**
 * evo.ts - Self-Evolving Agent System Entry Point
 * Bootstrap with all heavy logic in src/main.ts
 *
 * Improvements applied (2026-05-16):
 *  - Split into src/main.ts for better separation of concerns
 *  - Entry point now just imports compiled main.js
 *  - Maintains full backward compatibility
 *  - Easier to test and maintain
 *
 * Previous improvements (from original):
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

import './src/main.js';
