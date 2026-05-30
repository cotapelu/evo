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
export class SlashCommandHandler {
  constructor(private ctx: SlashCommandContext) {}

  async handle(command: string, args: string[]): Promise<void> {
    switch (command) {
      case 'clear':
        this.ctx.chatContainer.clear();
        break;
      case 'exit':
      case 'quit':
        await this.ctx.shutdown();
        break;
      case 'compact':
        await this.handleCompact();
        break;
      case 'model':
        await this.handleModel(args);
        break;
      case 'thinking':
        await this.ctx.showThinkingSelector();
        break;
      case 'models':
        await this.ctx.showModelSelector();
        break;
      case 'resources':
        await this.ctx.showLoadedResources();
        break;
      default:
        console.log(`Unknown command: /${command}`);
    }
  }

  private async handleCompact(): Promise<void> {
    try {
      await (this.ctx.session as any).compact?.();
    } catch (e) {
      console.error('Compaction failed:', e);
    }
  }

  private async handleModel(args: string[]): Promise<void> {
    const session = this.ctx.session as any;
    if (args.length === 0) {
      const result = session.cycleModel?.();
      if (result) {
        console.log(`Switched to ${result.model.id}`);
      }
    } else {
      const spec = args.join(' ');
      const available = (session.modelRegistry?.getAvailable?.() || []) as any[];
      const match = available.find((m: any) => `${m.provider}/${m.id}` === spec || m.id === spec);
      if (match) {
        session.model = match;
        console.log(`Model set to ${match.id}`);
      } else {
        console.log(`Model not found: ${spec}`);
      }
    }
  }
}
