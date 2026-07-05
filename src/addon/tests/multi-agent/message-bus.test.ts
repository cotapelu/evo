import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageBus } from '../../extensions/multi-agent-tool/message-bus.js';
import { messageBus as singleton } from '../../extensions/multi-agent-tool/message-bus.js';

function msg(type: string, payload?: any) {
  return { type, payload } as any;
}

describe('MessageBus', () => {
  let bus: MessageBus;

  beforeEach(() => {
    bus = new MessageBus();
  });

  describe('createEnvelope', () => {
    it('creates envelope for parent->child', () => {
      const envelope = bus.createEnvelope('parent', 'child1', msg('input'));
      expect(envelope.from).toBe('parent');
      expect(envelope.to).toBe('child1');
      expect(envelope.type).toBe('input');
      expect(envelope.payload).toBeUndefined();
      expect(typeof envelope.timestamp).toBe('string');
      expect(envelope.correlationId).toMatch(/^\d+-[a-z0-9]+$/);
    });

    it('includes payload when present', () => {
      const envelope = bus.createEnvelope('child', 'parent', msg('result', { ok: true }));
      expect(envelope.payload).toEqual({ ok: true });
    });
  });

  describe('sendToChild', () => {
    it('calls registered handlers and emits events', () => {
      const handler = vi.fn();
      const incoming = vi.fn();
      bus.onChildMessage('c1', handler);
      bus.onIncomingMessage('c1', incoming);
      const emitSpy = vi.spyOn(bus, 'emit');

      bus.sendToChild('c1', msg('ping', 'data'));

      expect(handler).toHaveBeenCalledWith(msg('ping', 'data'), expect.any(Object));
      expect(incoming).toHaveBeenCalledWith(msg('ping', 'data'));
      expect(emitSpy).toHaveBeenCalledWith('child:c1', expect.any(Object));
      expect(emitSpy).toHaveBeenCalledWith('message', expect.any(Object));
    });

    it('handles no handlers gracefully', () => {
      const emitSpy = vi.spyOn(bus, 'emit');
      bus.sendToChild('c1', msg('ping'));
      expect(emitSpy).toHaveBeenCalledWith('child:c1', expect.any(Object));
      expect(emitSpy).toHaveBeenCalledWith('message', expect.any(Object));
    });

    it('does not include payload when absent', () => {
      const handler = vi.fn();
      bus.onChildMessage('c2', handler);
      bus.sendToChild('c2', { type: 'event' } as any);
      const sentArg = handler.mock.calls[0][0];
      expect(sentArg.payload).toBeUndefined();
    });
  });

  describe('broadcastToAll', () => {
    it('sends to all children', () => {
      const h1 = vi.fn(), h2 = vi.fn();
      bus.onChildMessage('c1', h1);
      bus.onChildMessage('c2', h2);
      bus.broadcastToAll(msg('broadcast'));
      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it('does nothing when no children', () => {
      const emitSpy = vi.spyOn(bus, 'emit');
      bus.broadcastToAll(msg('broadcast'));
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe('onChildMessage / unsubscribe', () => {
    it('adds handler and can remove', () => {
      const handler = vi.fn();
      const unsubscribe = bus.onChildMessage('c1', handler);
      bus.sendToChild('c1', msg('a'));
      expect(handler).toHaveBeenCalledTimes(1);
      unsubscribe();
      bus.sendToChild('c1', msg('b'));
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('onIncomingMessage / unsubscribe', () => {
    it('adds incoming handler and can remove', () => {
      const handler = vi.fn();
      const unsubscribe = bus.onIncomingMessage('c1', handler);
      bus.sendToChild('c1', msg('x'));
      expect(handler).toHaveBeenCalledTimes(1);
      unsubscribe();
      bus.sendToChild('c1', msg('y'));
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendToParent', () => {
    it('calls all child-to-parent handlers and emits', () => {
      const h1 = vi.fn(), h2 = vi.fn();
      bus.childToParentHandlers.push(h1, h2);
      const emitSpy = vi.spyOn(bus, 'emit');
      bus.sendToParent(msg('result', { v: 1 }), 'c1');
      expect(h1).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
      expect(h2).toHaveBeenCalledTimes(1);
      expect(emitSpy).toHaveBeenCalledWith('parent', expect.any(Object));
      expect(emitSpy).toHaveBeenCalledWith('message', expect.any(Object));
    });

    it('works with no handlers', () => {
      const emitSpy = vi.spyOn(bus, 'emit');
      bus.sendToParent(msg('error', { msg: 'fail' }), 'c1');
      expect(emitSpy).toHaveBeenCalledWith('parent', expect.any(Object));
    });
  });

  describe('waitForParentMessage', () => {
    it('resolves when matching message arrives', async () => {
      const promise = bus.waitForParentMessage('c1', 'result', 1000);
      setTimeout(() => {
        bus.sendToChild('c1', msg('result', { val: 42 }));
      }, 10);
      const result = await promise;
      expect(result).not.toBeNull();
      if (result) {
        expect(result.type).toBe('result');
        expect(result.payload).toEqual({ val: 42 });
      }
    });

    it('resolves null on timeout', async () => {
      const promise = bus.waitForParentMessage('c1', 'input', 20);
      const result = await promise;
      expect(result).toBeNull();
    });
  });

  describe('waitForIncomingMessage', () => {
    it('resolves when matching parent->child message arrives', async () => {
      const promise = bus.waitForIncomingMessage('c2', 'cmd', 1000);
      setTimeout(() => {
        bus.sendToChild('c2', msg('cmd', { cmd: 'run' }));
      }, 10);
      const result = await promise;
      expect(result).not.toBeNull();
      if (result) {
        expect(result.type).toBe('cmd');
        expect(result.payload).toEqual({ cmd: 'run' });
      }
    });

    it('resolves null on timeout', async () => {
      const promise = bus.waitForIncomingMessage('c2', 'data', 20);
      const result = await promise;
      expect(result).toBeNull();
    });
  });

  describe('clearChild', () => {
    it('removes all handlers for child', () => {
      bus.onChildMessage('c1', vi.fn());
      bus.onIncomingMessage('c1', vi.fn());
      expect(bus.parentToChildHandlers.has('c1')).toBe(true);
      expect(bus.childIncomingHandlers.has('c1')).toBe(true);
      bus.clearChild('c1');
      expect(bus.parentToChildHandlers.has('c1')).toBe(false);
      expect(bus.childIncomingHandlers.has('c1')).toBe(false);
    });
  });

  // Additional tests for branch coverage
  describe('additional branch coverage', () => {
    it('onChildMessage supports multiple handlers for same child', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.onChildMessage('c1', h1);
      bus.onChildMessage('c1', h2);
      bus.sendToChild('c1', msg('ping'));
      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it('onIncomingMessage supports multiple handlers for same child', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.onIncomingMessage('c1', h1);
      bus.onIncomingMessage('c1', h2);
      bus.sendToChild('c1', msg('ping'));
      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it('waitForParentMessage ignores non-matching messages', async () => {
      const promise = bus.waitForParentMessage('c1', 'result', 1000);
      bus.sendToChild('c1', msg('other'));
      setTimeout(() => bus.sendToChild('c1', msg('result', { v: 1 })), 5);
      const result = await promise;
      expect(result).not.toBeNull();
      if (result) {
        expect(result.type).toBe('result');
        expect(result.payload).toEqual({ v: 1 });
      }
    });

    it('waitForIncomingMessage ignores non-matching types', async () => {
      const promise = bus.waitForIncomingMessage('c1', 'cmd', 1000);
      bus.sendToChild('c1', msg('data'));
      setTimeout(() => bus.sendToChild('c1', msg('cmd', { cmd: 'run' })), 5);
      const result = await promise;
      expect(result).not.toBeNull();
      if (result) {
        expect(result.type).toBe('cmd');
        expect(result.payload).toEqual({ cmd: 'run' });
      }
    });
  });
});

describe('MessageBus singleton', () => {
  it('exports a singleton instance', () => {
    expect(singleton).toBeInstanceOf(MessageBus);
  });
});
