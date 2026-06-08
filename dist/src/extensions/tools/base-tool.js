import { Mutex } from '../utils/mutex.js';
/**
 * Creates a stateful tool with per-session state and automatic mutex locking.
 */
export function createStatefulTool(config) {
    const states = new WeakMap();
    const mutexes = new WeakMap();
    const tool = {
        name: config.name,
        label: config.label,
        description: config.description,
        parameters: {},
        async execute(toolCallId, params, signal, onUpdate, ctx) {
            let state = states.get(ctx);
            let mutex = mutexes.get(ctx);
            if (!state) {
                state = config.createState(ctx);
                states.set(ctx, state);
            }
            if (!mutex) {
                mutex = new Mutex();
                mutexes.set(ctx, mutex);
            }
            const release = await mutex.lock();
            try {
                return await config.execute(toolCallId, params, signal, onUpdate, ctx, state);
            }
            finally {
                release();
            }
        },
    };
    if (config.renderCall) {
        tool.renderCall = config.renderCall;
    }
    if (config.renderResult) {
        tool.renderResult = config.renderResult;
    }
    return tool;
}
//# sourceMappingURL=base-tool.js.map