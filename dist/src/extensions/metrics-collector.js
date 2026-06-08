#!/usr/bin/env node
/**
 * Metrics Collector
 *
 * Wraps all tool registrations to record execution times and error rates.
 * Persists each metric as JSON lines to .pi/tool-metrics.ndjson.
 */
import { mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
export default function metricsCollector(api) {
    const originalRegisterTool = api.registerTool.bind(api);
    api.registerTool = (tool) => {
        const originalExecute = tool.execute.bind(tool);
        tool.execute = async (toolCallId, params, signal, onUpdate, ctx) => {
            const start = Date.now();
            try {
                const result = await originalExecute(toolCallId, params, signal, onUpdate, ctx);
                const duration = Date.now() - start;
                const isError = result.isError === true;
                const metric = {
                    toolName: tool.name,
                    timestamp: start,
                    duration,
                    success: !isError,
                };
                // Fire-and-forget persistence
                (async () => {
                    try {
                        const dir = join(ctx.cwd, '.pi');
                        await mkdir(dir, { recursive: true });
                        const path = join(dir, 'tool-metrics.ndjson');
                        await appendFile(path, JSON.stringify(metric) + '\n', 'utf-8');
                    }
                    catch {
                        // ignore
                    }
                })();
                return result;
            }
            catch (e) {
                const duration = Date.now() - start;
                const metric = {
                    toolName: tool.name,
                    timestamp: start,
                    duration,
                    success: false,
                    error: e?.message ?? String(e),
                };
                (async () => {
                    try {
                        const dir = join(ctx.cwd, '.pi');
                        await mkdir(dir, { recursive: true });
                        const path = join(dir, 'tool-metrics.ndjson');
                        await appendFile(path, JSON.stringify(metric) + '\n', 'utf-8');
                    }
                    catch {
                        // ignore
                    }
                })();
                throw e;
            }
        };
        originalRegisterTool(tool);
    };
}
//# sourceMappingURL=metrics-collector.js.map