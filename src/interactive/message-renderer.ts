import type { UserMessage } from '@earendil-works/pi-ai';
import { UserMessageComponent, AssistantMessageComponent } from '@earendil-works/pi-coding-agent';
import type { Container } from '@earendil-works/pi-tui';

/**
 * Renders chat messages from session state into the chat container.
 * Single responsibility: Convert message objects to UI components.
 */
export class MessageRenderer {
  constructor(private chatContainer: Container) {}

  /**
   * Render all messages from session state.
   */
  render(messages: any[]): void {
    for (const msg of messages) {
      if (msg.role === 'user') {
        const text = this.extractTextFromMessage(msg as UserMessage);
        this.chatContainer.addChild(new UserMessageComponent(text));
      } else if (msg.role === 'assistant') {
        this.chatContainer.addChild(new AssistantMessageComponent(msg));
      }
    }
  }

  /**
   * Extract plain text from a UserMessage.
   * Supports both string and array content formats.
   * Filters out non-text blocks (images, tool results, etc).
   */
  private extractTextFromMessage(msg: UserMessage): string {
    if (!msg.content) return '';
    if (typeof msg.content === 'string') return msg.content;
    // Content is Array<TextContent | ImageContent | ...>
    return (msg.content as Array<{ type: string; text?: string }>)
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text)
      .join('\n');
  }
}
