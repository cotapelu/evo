/**
 * Benchmark Suite for Evo Agent
 *
 * Measures:
 * - Pattern scanning performance
 * - File I/O throughput
 * - Pattern detection accuracy
 */
import { performance } from 'perf_hooks';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = __filename.split('/').slice(0, -1).join('/');
class BenchmarkRunner {
    results = [];
    async measure(name, fn, iterations = 10) {
        const times = [];
        // Warm-up run
        await fn();
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            await fn();
            const end = performance.now();
            times.push(end - start);
        }
        times.sort((a, b) => a - b);
        const sum = times.reduce((a, b) => a + b, 0);
        const avg = sum / times.length;
        const median = times[Math.floor(times.length / 2)];
        const min = times[0];
        const max = times[times.length - 1];
        const opsPerSec = 1000 / avg;
        this.results.push({
            name,
            avgMs: avg,
            medianMs: median,
            minMs: min,
            maxMs: max,
            samples: iterations,
            opsPerSec
        });
    }
    generateReport() {
        let report = 'Benchmark Results\n';
        report += '================\n\n';
        for (const result of this.results) {
            report += `${result.name}:\n`;
            report += `  Average: ${result.avgMs.toFixed(2)}ms\n`;
            report += `  Median:  ${result.medianMs.toFixed(2)}ms\n`;
            report += `  Range:   ${result.minMs.toFixed(2)}ms - ${result.maxMs.toFixed(2)}ms\n`;
            report += `  Ops/sec: ${result.opsPerSec.toFixed(2)}\n`;
            report += `  Samples: ${result.samples}\n\n`;
        }
        return report;
    }
}
// Benchmark functions
async function benchPatternScanning(runner) {
    const { scanDirectory } = await import('../evolution/patterns.js');
    await runner.measure('Pattern scan (src/, with excludes)', async () => {
        await scanDirectory(join(process.cwd(), 'src'), ['.ts'], { exclude: ['dist', 'node_modules', '__tests__'] });
    }, 3);
}
async function benchFileRead(runner) {
    const testFile = join(process.cwd(), 'src', 'main.ts');
    await runner.measure('Read main.ts (10x)', async () => {
        for (let i = 0; i < 10; i++) {
            await readFile(testFile, 'utf-8');
        }
    }, 1);
}
async function benchPatternCheck(runner) {
    const { patterns } = await import('../evolution/patterns.js');
    // Load sample file content
    const sampleCode = await readFile(join(process.cwd(), 'src', 'extensions', 'git-integration.ts'), 'utf-8');
    await runner.measure('Single pattern check (trailing-whitespace)', async () => {
        const pattern = patterns.find(p => p.id === 'trailing-whitespace');
        if (pattern) {
            pattern.check(sampleCode, 'test.ts');
        }
    }, 100);
}
async function benchAllPatterns(runner) {
    const { patterns, scanDirectory } = await import('../evolution/patterns.js');
    await runner.measure('All patterns on sample file', async () => {
        for (const pattern of patterns) {
            pattern.check('async function test() {\n  return fetch().then(r => r.json());\n}', 'test.ts');
        }
    }, 100);
}
// Main
async function main() {
    console.log('🏃 Running benchmarks...\n');
    const runner = new BenchmarkRunner();
    // Run benchmarks
    await benchFileRead(runner);
    await benchPatternScanning(runner);
    await benchPatternCheck(runner);
    await benchAllPatterns(runner);
    const report = runner.generateReport();
    console.log(report);
    // Save to file
    const outDir = join(process.cwd(), 'bench-results');
    await mkdir(outDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outFile = join(outDir, `bench-${timestamp}.txt`);
    await writeFile(outFile, report);
    console.log(`📊 Report saved to: ${relative(process.cwd(), outFile)}\n`);
}
main().catch(err => {
    console.error('Benchmark failed:', err);
    process.exit(1);
});
//# sourceMappingURL=benchmark.js.map