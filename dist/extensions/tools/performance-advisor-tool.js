#!/usr/bin/env node
/**
 * Performance Advisor Tool
 *
 * Analyzes tool execution metrics collected by the metrics collector
 * and provides optimization suggestions.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
function computeStats(metrics) {
    const map = new Map();
    for (const m of metrics) {
        const existing = map.get(m.toolName) || { sum: 0, count: 0, max: 0, errors: 0, last: 0 };
        existing.sum += m.duration;
        existing.count += 1;
        existing.max = Math.max(existing.max, m.duration);
        if (!m.success)
            existing.errors += 1;
        existing.last = Math.max(existing.last, m.timestamp);
        map.set(m.toolName, existing);
    }
    const tools = [];
    let totalInvocations = 0;
    let totalDuration = 0;
    let totalErrors = 0;
    for (const [name, agg] of map) {
        const avg = agg.sum / agg.count;
        tools.push({
            toolName: name,
            invocations: agg.count,
            avgDuration: avg,
            maxDuration: agg.max,
            errors: agg.errors,
            lastTimestamp: agg.last,
        });
        totalInvocations += agg.count;
        totalDuration += agg.sum;
        totalErrors += agg.errors;
    }
    // Sort by average duration descending
    tools.sort((a, b) => b.avgDuration - a.avgDuration);
    const overallAvgDuration = totalInvocations > 0 ? totalDuration / totalInvocations : 0;
    const overallErrorRate = totalInvocations > 0 ? totalErrors / totalInvocations : 0;
    // Generate suggestions
    const suggestions = [];
    if (tools.length === 0) {
        suggestions.push('No tool metrics collected yet. Run some tools to gather data.');
    }
    else {
        const slowTools = tools.filter(t => t.avgDuration > 2000);
        if (slowTools.length > 0) {
            suggestions.push(`Consider optimizing slow tools: ${slowTools.map(t => `${t.toolName} (avg ${Math.round(t.avgDuration)}ms)`).join(', ')}.`);
        }
        const errorProne = tools.filter(t => t.errors / t.invocations > 0.2);
        if (errorProne.length > 0) {
            suggestions.push(`High failure rate on: ${errorProne.map(t => `${t.toolName} (${Math.round((t.errors / t.invocations) * 100)}%)`).join(', ')}. Check tool logic or inputs.`);
        }
        if (totalInvocations > 1000) {
            suggestions.push('Metrics file is getting large. Consider periodic cleanup of .pi/tool-metrics.ndjson.');
        }
        if (overallErrorRate > 0.1) {
            suggestions.push(`Overall error rate is high (${Math.round(overallErrorRate * 100)}%). Investigate failing tools.`);
        }
        if (suggestions.length === 0) {
            suggestions.push('Performance looks good! No major issues detected.');
        }
    }
    return {
        tools,
        suggestions,
        totalInvocations,
        overallAvgDuration,
        overallErrorRate,
    };
}
export function registerPerformanceAdvisorTool(api) {
    api.registerTool({
        name: 'performance_advisor',
        label: 'Performance Advisor',
        description: 'Analyzes tool execution metrics collected by the metrics collector and provides optimization suggestions.',
        parameters: {
            type: 'object',
            properties: {},
        },
        async execute(toolCallId, params, signal, onUpdate, ctx) {
            const path = join(ctx.cwd, '.pi', 'tool-metrics.ndjson');
            let content;
            let details;
            try {
                const data = await readFile(path, 'utf-8');
                const lines = data.split('\n').filter(l => l.trim() !== '');
                const metrics = [];
                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line);
                        // Validate required fields
                        if (parsed.toolName && parsed.duration !== undefined && parsed.success !== undefined && parsed.timestamp !== undefined) {
                            metrics.push(parsed);
                        }
                    }
                    catch {
                        // skip invalid lines
                    }
                }
                details = computeStats(metrics);
                // Build report text
                const reportLines = [
                    `📊 Performance Analysis`,
                    `Total invocations: ${details.totalInvocations}`,
                    `Overall avg duration: ${Math.round(details.overallAvgDuration)}ms`,
                    `Overall error rate: ${(details.overallErrorRate * 100).toFixed(1)}%`,
                    '',
                    '🔧 Suggestions:',
                    ...details.suggestions.map(s => `- ${s}`),
                    '',
                    'Per-tool stats:',
                ];
                for (const t of details.tools.slice(0, 20)) { // top 20 by avg duration
                    reportLines.push(`- ${t.toolName}: ${t.invocations} calls, avg ${Math.round(t.avgDuration)}ms, max ${t.maxDuration}ms, ${t.errors} errors`);
                }
                content = reportLines.join('\n');
            }
            catch (e) {
                if (e.code === 'ENOENT' || e.code === 'ENOTDIR') {
                    details = { tools: [], suggestions: ['No metrics data available.'], totalInvocations: 0, overallAvgDuration: 0, overallErrorRate: 0 };
                    content = 'No tool metrics file found. Make sure the metrics collector extension is enabled and tools have been executed.';
                }
                else {
                    details = { tools: [], suggestions: [`Error reading metrics: ${e.message}`], totalInvocations: 0, overallAvgDuration: 0, overallErrorRate: 0 };
                    content = `Failed to analyze performance: ${e.message}`;
                }
            }
            return { content: [{ type: 'text', text: content }], details, isError: false };
        },
    });
}
//# sourceMappingURL=performance-advisor-tool.js.map