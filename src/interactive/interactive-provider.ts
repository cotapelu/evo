/**
 * Interactive Mode Provider
 *
 * This provider encapsulates and utilizes all exports from interactive-mode.ts:
 * - InteractiveMode class
 * - InteractiveModeOptions interface
 * - formatResumeCommand function
 * - isApiKeyLoginProvider function
 *
 * It provides a higher-level abstraction for creating and managing interactive mode instances.
 */

import {
  InteractiveMode,
  InteractiveModeOptions,
  type AgentSessionRuntime,
} from '@earendil-works/pi-coding-agent';

/**
 * Provider class for InteractiveMode.
 * Manages creation and lifecycle of InteractiveMode instances.
 */
export class InteractiveModeProvider {
  private interactiveModeInstance: InteractiveMode | null = null;

  /**
   * Constructs a new InteractiveModeProvider.
   * @param runtime - The AgentSessionRuntime to use for interactive mode.
   */
  constructor(private runtime: AgentSessionRuntime) {}

  /**
   * Creates a new InteractiveMode instance with the given options.
   * Uses InteractiveModeOptions interface for type-safe configuration.
   * 
   * Usage of InteractiveModeOptions:
   * - migratedProviders?: string[] - Providers that were migrated to auth.json
   * - modelFallbackMessage?: string - Warning message if session model couldn't be restored
   * - initialMessage?: string - Initial message to send on startup
   * - initialImages?: ImageContent[] - Images to attach to the initial message
   * - initialMessages?: string[] - Additional messages to send after initial
   * - verbose?: boolean - Force verbose startup
   * 
   * @param options - Configuration options for the interactive mode
   * @returns The created InteractiveMode instance
   */
  createInteractiveMode(options: InteractiveModeOptions = {}): InteractiveMode {
    this.interactiveModeInstance = new InteractiveMode(this.runtime, options);
    return this.interactiveModeInstance;
  }

  /**
   * Gets the currently active InteractiveMode instance, if any.
   */
  getInteractiveMode(): InteractiveMode | null {
    return this.interactiveModeInstance;
  }

  /**
   * Runs the interactive mode with the given options.
   * Convenience method that creates the instance if needed and calls run().
   * 
   * @param options - Optional InteractiveModeOptions to pass to createInteractiveMode
   * @returns Promise that resolves when interactive mode exits (normally never)
   */
  async run(options: InteractiveModeOptions = {}): Promise<void> {
    let mode = this.interactiveModeInstance;
    if (!mode) {
      mode = this.createInteractiveMode(options);
    }
    await mode.run();
  }
}

/**
 * Default export for convenient import.
 */
export default InteractiveModeProvider;
