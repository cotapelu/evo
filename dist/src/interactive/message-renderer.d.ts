import type { Container } from '@earendil-works/pi-tui';
/**
 * Renders chat messages from session state into the chat container.
 * Single responsibility: Convert message objects to UI components.
 */
export declare class MessageRenderer {
    private chatContainer;
    constructor(chatContainer: Container);
    /**
     * Render all messages from session state.
     */
    render(messages: any[]): void;
    /**
     * Extract plain text from a UserMessage.
     * Supports both string and array content formats.
     * Filters out non-text blocks (images, tool results, etc).
     */
    private extractTextFromMessage;
}
//# sourceMappingURL=message-renderer.d.ts.map