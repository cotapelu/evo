import type { ToolDefinition, ExtensionContext } from '@earendil-works/pi-coding-agent';
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
export declare function createStatefulTool<TState>(config: StatefulToolConfig<TState>): ToolDefinition<any, any>;
//# sourceMappingURL=base-tool.d.ts.map