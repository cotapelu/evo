import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandRegistry } from '../extensions/master-tool/command-registry.js';
import { CommandExecutor } from '../extensions/master-tool/command-executor.js';
import { StateManager } from '../extensions/master-tool/state-manager.js';
import { getValidator } from '../extensions/master-tool/utils/command-validator.js';
import { Mutex } from '../extensions/master-tool/utils/mutex.js';
import { Type } from 'typebox';

describe('Master Tool Components', () => {
  describe('Mutex', () => {
    it('should lock and unlock correctly', async () => {
      const mutex = new Mutex();
      const release = await mutex.lock();
      const lock2 = mutex.lock();
      release();
      await expect(lock2).resolves.toBeDefined();
    });

    it('tryLock should work', () => {
      const mutex = new Mutex();
      expect(mutex.tryLock()).toBe(true);
      expect(mutex.tryLock()).toBe(false);
    });
  });

  describe('CommandValidator', () => {
    const validator = getValidator();

    it('should check rate limit', () => {
      const res = validator.checkRateLimit('testcmd');
      expect(res.allowed).toBe(true);
    });

    it('should detect prototype pollution', () => {
      const bad = JSON.parse('{"__proto__":{}}');
      const sec = validator.validateSecurity(bad, { name: 'test' });
      expect(sec.valid).toBe(false);
      expect(sec.errors).toContain('Potential prototype pollution detected');
    });

    it('should validate args with TypeBox schema', () => {
      const schema = Type.Object({ name: Type.String() });
      const res = validator.validateWithSchema({ name: 'Alice' }, schema);
      expect(res.valid).toBe(true);
      const res2 = validator.validateWithSchema({ name: 123 }, schema);
      expect(res2.valid).toBe(false);
      expect(res2.errors).toHaveLength(1);
    });
  });

  describe('StateManager', () => {
    let manager: StateManager;
    let mockCtx: any;

    beforeEach(() => {
      manager = new StateManager();
      mockCtx = {};
    });

    it('should create and retrieve generic state', () => {
      const state = manager.getOrCreateState('testcmd', mockCtx);
      expect(state).toBeDefined();
      expect(state.isDirty).toBe(false);
      state.markDirty();
      expect(state.isDirty).toBe(true);
    });

    it('should subscribe to state changes', () => {
      const state = manager.getOrCreateState('testcmd2', mockCtx);
      let notified = 0;
      const unsub = state.subscribe(() => { notified++; });
      state.markDirty();
      expect(notified).toBe(1);
      unsub();
      state.markDirty();
      expect(notified).toBe(1);
    });
  });

  describe('CommandRegistry', () => {
    let registry: CommandRegistry;

    beforeEach(async () => {
      registry = new CommandRegistry();
      await registry.initialize();
    });

    it('should discover commands', () => {
      const commands = registry.listCommands();
      expect(commands).toContain('git.status');
      expect(commands).toContain('dev.test');
      expect(commands).toContain('system.info');
      expect(commands).toContain('todo.manage');
      expect(commands).toContain('demo.counter');
    });

    it('should categorize commands', () => {
      const cats = registry.listCommandsByCategory();
      expect(cats.has('git')).toBe(true);
      expect(cats.has('dev')).toBe(true);
      expect(cats.has('system')).toBe(true);
      expect(cats.has('todo')).toBe(true);
      expect(cats.has('demo')).toBe(true);
    });

    it('should get metadata', () => {
      const meta = registry.getMetadata('system.info');
      expect(meta?.name).toBe('system.info');
      expect(meta?.category).toBe('system');
    });

    it('should execute system.info command and return tool result format', async () => {
      const result = await registry.execute('system.info', {} as any, {
        toolCallId: 'test',
        signal: undefined,
        onUpdate: undefined,
        ctx: {} as any,
        maxOutputSize: 1024 * 1024
      });
      if (result.isError) {
        console.error('System info error', result);
      }
      expect(result.isError).toBe(false);
      expect(result.details.code).toBe(0);
      const stdout = result.content.find(c => c.type === 'text')?.text || '';
      expect(stdout).toContain('System');
    });

    it('should reject unknown command', async () => {
      const result = await registry.execute('nonexistent', {} as any, {
        toolCallId: 'test',
        signal: undefined,
        onUpdate: undefined,
        ctx: {} as any,
        maxOutputSize: 1024 * 1024
      });
      expect(result.isError).toBe(true);
    });
  });
});
