import { RunningAgent } from './agent-manager.js';

export interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: Date;
  type?: 'direct' | 'broadcast' | 'event';
  metadata?: Record<string, any>;
}

export interface EventSubscription {
  agentId: string;
  eventType: string;
  handler: (event: Message) => void | Promise<void>;
}

export class MessageBus {
  private messages: Message[] = [];
  private pending: Map<string, Message[]> = new Map(); // agentId -> messages
  private subscriptions: EventSubscription[] = [];
  private logger: any;

  constructor(logger?: any) {
    this.logger = logger;
  }

  // Direct messaging
  send(from: string, to: string, content: string, metadata?: Record<string, any>): Message {
    const msg: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from,
      to,
      content,
      timestamp: new Date(),
      type: 'direct',
      metadata,
    };
    this.messages.push(msg);

    const queue = this.pending.get(to) || [];
    queue.push(msg);
    this.pending.set(to, queue);

    this.logger?.debug(`📨 Message from ${from} to ${to}: ${content.substring(0, 50)}...`);
    return msg;
  }

  // Broadcast to all agents
  broadcast(from: string, content: string, eventType?: string): Message[] {
    const messages: Message[] = [];
    // We'll deliver this via a special mechanism - for now, log it
    const msg: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from,
      to: 'all',
      content,
      timestamp: new Date(),
      type: 'broadcast',
      metadata: { eventType },
    };
    this.messages.push(msg);
    messages.push(msg);

    this.logger?.info(`📢 Broadcast from ${from} (${eventType || 'general'}): ${content.substring(0, 50)}...`);
    return messages;
  }

  // Publish event to subscribers
  async publish(eventType: string, from: string, content: string, metadata?: Record<string, any>): Promise<void> {
    const event: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from,
      to: 'subscribers',
      content,
      timestamp: new Date(),
      type: 'event',
      metadata: { ...metadata, eventType },
    };
    this.messages.push(event);

    // Notify subscribers
    const subs = this.subscriptions.filter(s => s.eventType === eventType || s.eventType === '*');
    for (const sub of subs) {
      try {
        await sub.handler(event);
      } catch (e) {
        this.logger?.error(`Error in event handler for ${sub.agentId}:`, e);
      }
    }
  }

  // Subscribe to events
  subscribe(agentId: string, eventType: string, handler: (event: Message) => void | Promise<void>): () => void {
    const sub: EventSubscription = { agentId, eventType, handler };
    this.subscriptions.push(sub);
    this.logger?.debug(`📡 Agent ${agentId} subscribed to event type: ${eventType}`);

    // Return unsubscribe function
    return () => {
      const idx = this.subscriptions.indexOf(sub);
      if (idx !== -1) this.subscriptions.splice(idx, 1);
    };
  }

  // Unsubscribe all for an agent
  unsubscribeAll(agentId: string): void {
    this.subscriptions = this.subscriptions.filter(s => s.agentId !== agentId);
    this.pending.delete(agentId);
  }

  // Get pending messages for agent
  getMessagesForAgent(agentId: string): Message[] {
    const queue = this.pending.get(agentId) || [];
    this.pending.set(agentId, []);
    return queue;
  }

  // Get all messages (for debugging/history)
  getRecentMessages(limit: number = 100): Message[] {
    return this.messages.slice(-limit);
  }

  // Get message history for an agent
  getAgentHistory(agentId: string, limit?: number): Message[] {
    const relevant = this.messages.filter(m => m.from === agentId || m.to === agentId || m.to === 'all');
    if (limit) return relevant.slice(-limit);
    return relevant;
  }

  // Clear all state (for testing)
  clear(): void {
    this.messages = [];
    this.pending.clear();
    this.subscriptions = [];
  }
}
