import { RunningAgent } from './agent-manager.js';

export interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: Date;
}

export class MessageBus {
  private messages: Message[] = [];
  private pending: Map<string, Message[]> = new Map(); // agentId -> messages

  send(from: string, to: string, content: string): Message {
    const msg: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from,
      to,
      content,
      timestamp: new Date(),
    };
    this.messages.push(msg);

    const queue = this.pending.get(to) || [];
    queue.push(msg);
    this.pending.set(to, queue);

    return msg;
  }

  getMessagesForAgent(agentId: string): Message[] {
    const queue = this.pending.get(agentId) || [];
    this.pending.set(agentId, []); // clear
    return queue;
  }

  getRecentMessages(limit: number = 100): Message[] {
    return this.messages.slice(-limit);
  }
}
