import type { AgentSessionRuntime } from '@earendil-works/pi-coding-agent';
/**
 * Minimal context for slash commands.
 * Avoids coupling to InteractiveMode internals.
 */
export interface SlashCommandContext {
    chatContainer: any;
    session: AgentSessionRuntime['session'];
    shutdown: () => Promise<void>;
    showThinkingSelector: () => Promise<void>;
    showModelSelector: () => Promise<void>;
    showLoadedResources: () => Promise<void>;
}
/**
 * Handles all slash commands.
 * Each command is self-contained; easy to test independently.
 */
export declare class SlashCommandHandler {
    private ctx;
    constructor(ctx: SlashCommandContext);
    handle(command: string, args: string[]): Promise<void>;
    private handleCompact;
    private handleModel;
}
//# sourceMappingURL=slash-command-handler.d.ts.map