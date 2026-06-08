/**
 * Interactive Mode Provider
 *
 * Uses public API from @earendil-works/pi-coding-agent
 */
import { InteractiveMode, InteractiveModeOptions, type AgentSessionRuntime } from '@earendil-works/pi-coding-agent';
export type { InteractiveModeOptions };
export { InteractiveMode };
/**
 * Provider options
 */
export interface InteractiveModeProviderOptions extends InteractiveModeOptions {
    fallbackToPrintMode?: boolean;
    autoRetry?: number;
    retryDelayMs?: number;
    eventCallbacks?: {
        onAgentStart?: (event: any) => void;
        onAgentEnd?: (event: any) => void;
        onError?: (error: Error) => void;
    };
}
/**
 * Provider status
 */
export interface ProviderStatus {
    mode: 'interactive' | 'print' | 'uninitialized' | 'shutdown';
    isRunning: boolean;
    sessionId?: string;
    sessionFile?: string;
    subscriptionsCount: number;
    uptimeMs: number;
    lastError?: Error;
    startTime: number;
}
/**
 * Interactive Mode Provider
 */
export declare class InteractiveModeProvider {
    private runtime;
    private interactiveModeInstance;
    private status;
    private subscriptionHandles;
    private startTime;
    private options;
    constructor(runtime: AgentSessionRuntime, options?: InteractiveModeProviderOptions);
    /**
     * Get status
     */
    getStatus(): ProviderStatus;
    /**
     * Get runtime
     */
    getRuntime(): AgentSessionRuntime;
    /**
     * Create InteractiveMode
     */
    createInteractiveMode(options?: InteractiveModeOptions): InteractiveMode;
    /**
     * Get InteractiveMode instance
     */
    getInteractiveMode(): InteractiveMode | null;
    /**
     * Run interactive mode
     */
    run(options?: InteractiveModeOptions): Promise<void>;
    /**
     * Internal: run interactive
     */
    private doRunInteractive;
    /**
     * Run print mode
     */
    runPrintMode(query: string, printOptions?: any): Promise<void>;
    /**
     * Subscribe to session events
     */
    private subscribeToSessionEvents;
    /**
     * Handle error
     */
    private handleError;
    /**
     * Sleep
     */
    private sleep;
    /**
     * Print mode fallback
     */
    private runPrintModeFallback;
    /**
     * Unsubscribe all
     */
    private unsubscribeAll;
    /**
     * Stop gracefully
     */
    stop(): Promise<void>;
    /**
     * Show error in UI
     */
    showError(message: string): void;
    /**
     * Show warning in UI
     */
    showWarning(message: string): void;
    /**
     * Graceful shutdown
     */
    shutdown(): Promise<void>;
}
/**
 * Create provider
 */
export declare function createInteractiveModeProvider(runtime: AgentSessionRuntime, options?: InteractiveModeProviderOptions): InteractiveModeProvider;
/**
 * Quick start: create runtime and run interactive
 */
export declare function startInteractive(runtimeOptions?: any, modeOptions?: InteractiveModeProviderOptions): Promise<InteractiveModeProvider>;
/**
 * Run one-off print query
 */
export declare function runOneOffQuery(query: string, runtimeOptions?: any, printOptions?: any): Promise<void>;
//# sourceMappingURL=interactive-provider.d.ts.map