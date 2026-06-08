import { UserMessageComponent, AssistantMessageComponent } from '@earendil-works/pi-coding-agent';
/**
 * Renders chat messages from session state into the chat container.
 * Single responsibility: Convert message objects to UI components.
 */
export class MessageRenderer {
    chatContainer;
    constructor(chatContainer) {
        this.chatContainer = chatContainer;
    }
    /**
     * Render all messages from session state.
     */
    render(messages) {
        for (const msg of messages) {
            if (msg.role === 'user') {
                const text = this.extractTextFromMessage(msg);
                this.chatContainer.addChild(new UserMessageComponent(text));
            }
            else if (msg.role === 'assistant') {
                this.chatContainer.addChild(new AssistantMessageComponent(msg));
            }
        }
    }
    /**
     * Extract plain text from a UserMessage.
     * Supports both string and array content formats.
     * Filters out non-text blocks (images, tool results, etc).
     */
    extractTextFromMessage(msg) {
        if (!msg.content)
            return '';
        if (typeof msg.content === 'string')
            return msg.content;
        // Content is Array<TextContent | ImageContent | ...>
        return msg.content
            .filter((c) => c.type === 'text' && typeof c.text === 'string')
            .map((c) => c.text)
            .join('\n');
    }
}
//# sourceMappingURL=message-renderer.js.map