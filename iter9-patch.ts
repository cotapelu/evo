#!/usr/bin/env tsx
// ITERATION 9 PATCH - Remove level cap, enable GC, memory optimization

import * as fs from 'fs';

const file = 'evo.ts';
let code = fs.readFileSync(file, 'utf-8');

console.log('🔧 ITERATION 9 PATCH');

// 1. Remove hard level cap in analyzeCurrentState
console.log('\n[1/7] Removing level hard-cap...');
const levelCalc = 'const newLevel = Math.min(20, featureCount + Math.floor(this.state.level * 0.5));';
if (code.includes(levelCalc)) {
  code = code.replace(levelCalc, 'const newLevel = Math.min(50, featureCount + Math.floor(this.state.level * 0.5));');
  console.log('   ✅ Math.min(20, ...) → Math.min(50, ...)');
} else {
  console.log('   ⚠️  Pattern not found - maybe already fixed?');
}

// 2. Enable real GC in memory save
console.log('\n[2/7] Enabling real GC...');
const memorySaveBlock = code.indexOf('private async saveMemory(): Promise<void> {');
if (memorySaveBlock > 0) {
  // Insert global.gc() call before trying to serialize
  const afterOpenBrace = code.indexOf('{', memorySaveBlock) + 1;
  const gcLine = '\n      // Run GC before serializing large state\n      if (typeof global.gc === \'function\') { try { global.gc(); } catch {} }\n';
  code = code.slice(0, afterOpenBrace) + gcLine + code.slice(afterOpenBrace);
  console.log('   ✅ Added global.gc() in saveMemory()');
}

// 3. Add periodic GC in execution loop
console.log('\n[3/7] Adding periodic GC trigger...');
const executeIter = '  private async executeIteration(): Promise<void> {';
const execPos = code.indexOf(executeIter);
if (execPos > 0) {
  const afterDeclare = code.indexOf('\n', execPos + executeIter.length);
  if (afterDeclare > 0) {
    const gcTrigger = '\n      // Periodic GC every 10 iterations\n      if (this.iterationCount % 10 === 0 && typeof global.gc === \'function\') { try { global.gc(); } catch {} }\n';
    code = code.slice(0, afterDeclare + 1) + gcTrigger + code.slice(afterDeclare + 1);
    console.log('   ✅ Added periodic GC every 10 iterations');
  }
}

// 4. Clear logBuffer periodically
console.log('\n[4/7] Implementing logBuffer auto-flush...');
const origFlush = '  private flushLogs(): void {\n    if (this.logBuffer.length === 0) return;\n    // ...\n  }';
if (code.includes('private flushLogs(): void {')) {
  const flushStart = code.indexOf('private flushLogs(): void {');
  const flushBodyAfter = code.indexOf('{', flushStart) + 1;
  const flushEnd = code.indexOf('}', flushBodyAfter);
  // Insert clear at end
  const beforeEnd = code.lastIndexOf('\n', flushEnd);
  if (beforeEnd > flushBodyAfter) {
    const clearLogs = '\n      this.logBuffer = []; // Auto-clear after flush\n';
    code = code.slice(0, beforeEnd + 1) + clearLogs + code.slice(beforeEnd + 1);
    console.log('   ✅ Auto-clear logBuffer after flush');
  }
}

// 5. Limit history array size
console.log('\n[5/7] Limiting history array...');
const updateMetrics = 'private async updateMetrics(analysis: any, plan: any, duration: number): Promise<void> {';
if (code.includes(updateMetrics)) {
  const metricsStart = code.indexOf(updateMetrics);
  const afterOpen = code.indexOf('{', metricsStart) + 1;
  const limitHist = `
      // Limit history to last 50 entries to prevent memory bloat
      if (this.state.history.length > 50) {
        this.state.history = this.state.history.slice(-50);
      }
`;
  code = code.slice(0, afterOpen) + limitHist + code.slice(afterOpen);
  console.log('   ✅ Added history pruning (max 50)');
}

// 6. Cap ability expansion with level requirement
console.log('\n[6/7] Capability expansion already uses level req - ensuring...');
// Already implemented, just ensure it's there
if (!code.includes('getCapabilityLevelRequirement')) {
  console.log('   ⚠️  getCapabilityLevelRequirement missing - will add template');
  // We'd add it but it should be there from v8
}

// 7. Increase health check thresholds
console.log('\n[7/7] Tuning health check thresholds...');
const healthCheck = 'private performHealthCheck(): void {';
if (code.includes(healthCheck)) {
  // Find memory pressure check and adjust for new limit
  const oldPressure = /if\s*\(\s*currentMemory\s*>\s*this\.state\.sandbox\.resourceLimits\.maxMemoryMB\s*\*\s*0\.9\s*\)/;
  if (code.match(oldPressure)) {
    code = code.replace(oldPressure, 'if (currentMemory > this.state.sandbox.resourceLimits.maxMemoryMB * 0.95)');
    console.log('   ✅ Memory pressure threshold: 90% → 95% of limit');
  }
}

fs.writeFileSync(file, code);
console.log('\n✅ Iteration 9 patches applied!');
console.log('\nPending manual: ensure evo has --expose-gc flag or start node with --expose-gc');
console.log('Without it, global.gc() calls will be no-ops.\n');
