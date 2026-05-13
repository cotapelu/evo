// __tests__/messaging.test.ts - Unit tests for Messaging module

import { MessageQueue, Message } from '../messaging.js';

describe('MessageQueue', () => {
  let queue: MessageQueue;

  beforeEach(() => {
    queue = new MessageQueue(100);
  });

  test('should enqueue and retrieve messages', () => {
    const msg = queue.enqueue({
      from: 'agent-1',
      to: 'agent-2',
      content: { type: 'ping' },
      type: 'request',
      priority: 1
    });

    expect(msg.id).toBeDefined();
    expect(msg.timestamp).toBeDefined();

    const messages = queue.getForAgent('agent-2');
    expect(messages).toHaveLength(1);
    expect(messages[0].from).toBe('agent-1');
    expect(messages[0].content.type).toBe('ping');
  });

  test('should filter messages by TTL', () => {
    const msg = queue.enqueue({
      from: 'agent-1',
      to: 'agent-2',
      content: {},
      type: 'request',
      ttl: 0 // expired immediately
    });

    const messages = queue.getForAgent('agent-2', Date.now() + 1000);
    expect(messages).toHaveLength(0);
  });

  test('should respect maxSize and evict old messages', () => {
    const smallQueue = new MessageQueue(5);
    for (let i = 0; i < 10; i++) {
      smallQueue.enqueue({
        from: `agent-${i}`,
        to: 'agent-2',
        content: { index: i },
        type: 'request'
      });
    }

    expect(smallQueue.size()).toBeLessThanOrEqual(5);
  });

  test('should remove specific messages', () => {
    const msg1 = queue.enqueue({ from: 'a', to: 'b', content: {}, type: 'request' });
    const msg2 = queue.enqueue({ from: 'c', to: 'b', content: {}, type: 'request' });

    queue.remove([msg1.id]);

    const remaining = queue.getForAgent('b');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(msg2.id);
  });

  test('should clear all messages', () => {
    queue.enqueue({ from: 'a', to: 'b', content: {}, type: 'request' });
    queue.enqueue({ from: 'c', to: 'd', content: {}, type: 'broadcast' });

    queue.clear();
    expect(queue.size()).toBe(0);
  });

  test('should calculate stats correctly', () => {
    queue.enqueue({ from: 'a', to: 'b', content: {}, type: 'request' });
    queue.enqueue({ from: 'c', to: 'b', content: {}, type: 'broadcast' });
    queue.enqueue({ from: 'd', to: 'e', content: {}, type: 'gossip' });

    const stats = queue.getStats();
    expect(stats.total).toBe(3);
    expect(stats.byType['request']).toBe(1);
    expect(stats.byType['broadcast']).toBe(1);
    expect(stats.byType['gossip']).toBe(1);
  });

  test('should expire old messages', () => {
    const msg = queue.enqueue({
      from: 'a',
      to: 'b',
      content: {},
      type: 'request',
      ttl: 0 // expired immediately
    });

    // Advance time and expire
    const expired = queue.expire(2000);
    expect(expired).toBeGreaterThanOrEqual(1);
    expect(queue.size()).toBe(0);
  });

  test('should return all messages', () => {
    queue.enqueue({ from: 'a', to: 'b', content: {}, type: 'request' });
    queue.enqueue({ from: 'c', to: 'd', content: {}, type: 'broadcast' });

    const all = queue.getAll();
    expect(all).toHaveLength(2);
  });
});
