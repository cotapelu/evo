import type { ExtensionAPI, ToolDefinition, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { Mutex } from '../utils/mutex.js';

export interface StatefulToolConfig<TState> {
  name: string;
  label: string;
  description: string;
  createState: (ctx: ExtensionContext) => TState;
  execute: (toolCallId: string, params: any, signal: any, onUpdate: any, ctx: ExtensionContext, state: TState) => Promise<any>;
  renderCall?: (args: any, theme: any, context: any) => any;
  renderResult?: (result: any, options: any, theme: any, context: any) => any;
}

/**
 * Creates a stateful tool with per-session state and automatic mutex locking.
 */
export function createStatefulTool<TState>(config: StatefulToolConfig<TState>): ToolDefinition<any, any> {
  const states = new WeakMap<ExtensionContext, TState>();
  const mutexes = new WeakMap<ExtensionContext, Mutex>();

  const tool: ToolDefinition<any, any> = {
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
      } finally {
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