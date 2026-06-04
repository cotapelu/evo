/**
 * Interactive Mode Provider
 *
 * Uses public API from @earendil-works/pi-coding-agent
 */

import {
  InteractiveMode,
  InteractiveModeOptions,
  runPrintMode,
  type AgentSessionRuntime,
} from '@earendil-works/pi-coding-agent';

// Re-export
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
export class InteractiveModeProvider {
  private interactiveModeInstance: InteractiveMode | null = null;
  private status: ProviderStatus;
  private subscriptionHandles: Array<() => void> = [];
  private startTime: number;
  private options: InteractiveModeProviderOptions;

  constructor(
    private runtime: AgentSessionRuntime,
    options: InteractiveModeProviderOptions = {}
  ) {
    this.options = options;
    this.startTime = Date.now();
    this.status = {
      mode: 'uninitialized',
      isRunning: false,
      subscriptionsCount: 0,
      uptimeMs: 0,
      startTime: this.startTime,
    };
  }

  /**
   * Get status
   */
  getStatus(): ProviderStatus {
    const session = this.runtime.session;
    return {
      ...this.status,
      sessionId: session?.sessionId,
      sessionFile: session?.sessionFile,
      uptimeMs: Date.now() - this.startTime,
    };
  }

  /**
   * Get runtime
   */
  getRuntime(): AgentSessionRuntime {
    return this.runtime;
  }

  /**
   * Create InteractiveMode
   */
  createInteractiveMode(options: InteractiveModeOptions = {}): InteractiveMode {
    const mergedOptions: InteractiveModeOptions = {
      ...this.options,
      ...options,
    };

    this.interactiveModeInstance = new InteractiveMode(this.runtime, mergedOptions);
    this.status.mode = 'interactive';
    return this.interactiveModeInstance;
  }

  /**
   * Get InteractiveMode instance
   */
  getInteractiveMode(): InteractiveMode | null {
    return this.interactiveModeInstance;
  }

  /**
   * Run interactive mode
   */
  async run(options: InteractiveModeOptions = {}): Promise<void> {
    let attempt = 0;
    const maxAttempts = this.options.autoRetry ?? 1;

    while (attempt < maxAttempts) {
      try {
        if (attempt > 0) {
          console.log(`🔄 Retrying... (${attempt + 1}/${maxAttempts})`);
          await this.sleep(this.options.retryDelayMs ?? 1000);
        }

        await this.doRunInteractive(options);
        return;
      } catch (error) {
        attempt++;
        this.handleError(error);

        if (attempt >= maxAttempts) {
          if (this.options.fallbackToPrintMode) {
            console.log('📄 Falling back to print mode...');
            await this.runPrintModeFallback(``);
            return;
          }
          throw error;
        }
      }
    }
  }

  /**
   * Internal: run interactive
   */
  private async doRunInteractive(options: InteractiveModeOptions): Promise<void> {
    this.status.isRunning = true;
    this.status.startTime = Date.now();

    try {
      let mode = this.interactiveModeInstance;
      if (!mode) {
        mode = this.createInteractiveMode(options);
      }

      this.subscribeToSessionEvents();
      await mode.run();
    } finally {
      this.status.isRunning = false;
    }
  }

  /**
   * Run print mode
   */
  async runPrintMode(query: string, printOptions?: any): Promise<void> {
    this.status.mode = 'print';
    this.status.isRunning = true;

    try {
      await runPrintMode(this.runtime, {
        initialMessage: query,
        ...printOptions,
      });
    } finally {
      this.status.isRunning = false;
      this.status.mode = 'interactive';
    }
  }

  /**
   * Subscribe to session events
   */
  private subscribeToSessionEvents(): void {
    const callbacks = this.options.eventCallbacks;
    if (!callbacks) return;

    const session = this.runtime.session;
    if (!session) return;

    const unsubscribe = session.subscribe((event: any) => {
      switch (event.type) {
        case 'agent_start':
          callbacks.onAgentStart?.(event);
          break;
        case 'agent_end':
          callbacks.onAgentEnd?.(event);
          break;
      }
    });

    this.subscriptionHandles.push(unsubscribe);
    this.status.subscriptionsCount = this.subscriptionHandles.length;
  }

  /**
   * Handle error
   */
  private handleError(error: unknown): void {
    const err = error instanceof Error ? error : new Error(String(error));
    this.status.lastError = err;
    console.warn(`[InteractiveModeProvider] ${err.message}`);

    this.options.eventCallbacks?.onError?.(err);
  }

  /**
   * Sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Print mode fallback
   */
  private async runPrintModeFallback(message: string): Promise<void> {
    await this.runPrintMode(message);
  }

  /**
   * Unsubscribe all
   */
  private unsubscribeAll(): void {
    for (const unsub of this.subscriptionHandles) {
      try {
        unsub();
      } catch {
        // ignore
      }
    }
    this.subscriptionHandles = [];
    this.status.subscriptionsCount = 0;
  }

  /**
   * Stop gracefully
   */
  async stop(): Promise<void> {
    this.unsubscribeAll();

    if (this.interactiveModeInstance) {
      try {
        await this.interactiveModeInstance.stop();
      } catch (error) {
        console.warn('Error stopping interactive mode:', error);
      }
      this.interactiveModeInstance = null;
    }

    this.status.mode = 'shutdown';
    this.status.isRunning = false;
  }

  /**
   * Show error in UI
   */
  showError(message: string): void {
    if (this.interactiveModeInstance) {
      this.interactiveModeInstance.showError(message);
    } else {
      console.error(`❌ ${message}`);
    }
  }

  /**
   * Show warning in UI
   */
  showWarning(message: string): void {
    if (this.interactiveModeInstance) {
      this.interactiveModeInstance.showWarning(message);
    } else {
      console.warn(`⚠️  ${message}`);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    await this.stop();
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create provider
 */
export function createInteractiveModeProvider(
  runtime: AgentSessionRuntime,
  options: InteractiveModeProviderOptions = {}
): InteractiveModeProvider {
  return new InteractiveModeProvider(runtime, options);
}

/**
 * Quick start: create runtime and run interactive
 */
export async function startInteractive(
  runtimeOptions?: any,
  modeOptions?: InteractiveModeProviderOptions
): Promise<InteractiveModeProvider> {
  const { createAndRunRuntime } = await import('../runtime/runtime-provider.js');
  const runtimeResult = await createAndRunRuntime(runtimeOptions);

  const provider = new InteractiveModeProvider(runtimeResult.runtime, modeOptions);
  await provider.run();

  return provider;
}

/**
 * Run one-off print query
 */
export async function runOneOffQuery(
  query: string,
  runtimeOptions?: any,
  printOptions?: any
): Promise<void> {
  const { createAndRunRuntime } = await import('../runtime/runtime-provider.js');
  const runtimeResult = await createAndRunRuntime(runtimeOptions);

  const provider = new InteractiveModeProvider(runtimeResult.runtime);
  await provider.runPrintMode(query, printOptions);
}
