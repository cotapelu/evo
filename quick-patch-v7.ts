#!/usr/bin/env tsx
// Minimal v7 patch: lower threshold + capability expansion

import * as fs from 'fs';

const file = 'evo.ts';
let code = fs.readFileSync(file, 'utf-8');

console.log('⚙️  Quick patch v7:');

// 1. Threshold: >=15 -> >=10
if (code.includes('level >= 15')) {
  code = code.replace(/level >= 15/g, 'level >= 10');
  console.log('  ✓ Threshold: 15 → 10');
}

// 2. Add expandCapabilities if missing
if (!code.includes('detectMissingCapabilities')) {
  const capsBlock = `
  private detectMissingCapabilities(): string[] {
    const all = ['self-awareness','basic-evolution','error-handling','persistence','file-system','replication','messaging','goal-management','logging','planning','health-monitoring','sandbox','security','statistics','documentation','testing','modularity','concurrency','deployment','worker-pool','ast-transformation','orchestration','performance-tuning','auto-recovery','distributed-coordination'];
    return all.filter(c => !this.state.capabilities.includes(c));
  }

  private async expandCapabilities(): Promise<void> {
    const missing = this.detectMissingCapabilities();
    if (missing.length === 0 || this.state.level < 10) return;
    const toAdd = missing.slice(0, 2);
    for (const cap of toAdd) {
      if (!this.state.capabilities.includes(cap)) {
        this.state.capabilities.push(cap);
        this.log('info', '🎁 Unlocked capability:', cap);
      }
    }
  }
`;
  // Insert before executeIteration
  const pos = code.indexOf('  private async executeIteration()');
  if (pos > 0) {
    code = code.slice(0, pos) + capsBlock + '\n' + code.slice(pos);
    console.log('  ✓ Added capability expansion methods');
  }
}

// 3. Ensure call to expandCapabilities
if (!code.includes('await this.expandCapabilities();')) {
  const pos = code.indexOf('  private async executeIteration() {');
  if (pos > 0) {
    const insert = pos + '  private async executeIteration() {'.length;
    const nl = code.indexOf('\n', insert);
    if (nl > insert) {
      code = code.slice(0, nl+1) + '      // Expand capabilities\n      await this.expandCapabilities();\n' + code.slice(nl+1);
      console.log('  ✓ Inserted expandCapabilities() call');
    }
  }
}

fs.writeFileSync(file, code);
console.log('\n✅ Patch applied!');
