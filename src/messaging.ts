// messaging.ts - Inter-Agent Messaging System
// Handles message passing, broadcasting, and gossip protocol

export interface Message {
  id: string;
  from: string;
  to: string;
  content: any;
  timestamp: string;
  type: 'request' | 'response' | 'broadcast' | 'gossip' | 'ping' | 'pong' | 'error' | 'heartbeat';
  priority?: number;
  ttl?: number;
}

export class MessageQueue {
  private messages: Message[] = [];
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  enqueue(msg: Omit<Message, 'id' | 'timestamp'>): Message {
    const message: Message = {
      ...msg,
      id: this.generateId(),
      timestamp: new Date().toISOString()
    };
    this.messages.push(message);
    if (this.messages.length > this.maxSize) {
      this.messages = this.messages.slice(-this.maxSize / 2);
    }
    return message;
  }

  getForAgent(agentId: string, currentTime?: number): Message[] {
    const now = currentTime || Date.now();
    return this.messages.filter(m =>
      m.to === agentId &&
      (m.ttl === undefined || (now - Date.parse(m.timestamp)) < m.ttl * 1000)
    );
  }

  getAll(): Message[] {
    return [...this.messages];
  }

  remove(messageIds: string[]): void {
    this.messages = this.messages.filter(m => !messageIds.includes(m.id));
  }

  expire(ageCutoffMs: number, now?: number): number {
    const currentNow = now || Date.now();
    const before = this.messages.length;
    this.messages = this.messages.filter(m => {
      const age = currentNow - Date.parse(m.timestamp);
      const tooOld = age > ageCutoffMs;
      const ttlExpired = m.ttl !== undefined && age >= m.ttl * 1000;
      return !(tooOld || ttlExpired);
    });
    return before - this.messages.length;
  }

  clear(): void {
    this.messages = [];
  }

  size(): number {
    return this.messages.length;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats(): { total: number; byType: Record<string, number>; expired: number } {
    const byType: Record<string, number> = {};
    const now = Date.now();
    let expired = 0;

    for (const m of this.messages) {
      byType[m.type] = (byType[m.type] || 0) + 1;
      if (m.ttl && (now - Date.parse(m.timestamp)) > m.ttl * 1000) {
        expired++;
      }
    }

    return { total: this.messages.length, byType, expired };
  }
}
