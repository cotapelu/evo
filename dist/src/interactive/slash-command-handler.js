/**
 * Handles all slash commands.
 * Each command is self-contained; easy to test independently.
 */
export class SlashCommandHandler {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    async handle(command, args) {
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
    async handleCompact() {
        try {
            await this.ctx.session.compact?.();
        }
        catch (e) {
            console.error('Compaction failed:', e);
        }
    }
    async handleModel(args) {
        const session = this.ctx.session;
        if (args.length === 0) {
            const result = session.cycleModel?.();
            if (result) {
                console.log(`Switched to ${result.model.id}`);
            }
        }
        else {
            const spec = args.join(' ');
            const available = (session.modelRegistry?.getAvailable?.() || []);
            const match = available.find((m) => `${m.provider}/${m.id}` === spec || m.id === spec);
            if (match) {
                session.model = match;
                console.log(`Model set to ${match.id}`);
            }
            else {
                console.log(`Model not found: ${spec}`);
            }
        }
    }
}
//# sourceMappingURL=slash-command-handler.js.map