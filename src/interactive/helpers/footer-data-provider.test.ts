import { jest } from '@jest/globals';
import { FooterDataProvider } from './footer-data-provider.js';

describe('FooterDataProvider', () => {
  let provider: FooterDataProvider;

  beforeEach(() => {
    provider = new FooterDataProvider(process.cwd());
  });

  describe('initial state', () => {
    it('returns null branch', () => {
      expect(provider.getGitBranch()).toBeNull();
    });

    it('returns zero available provider count', () => {
      expect(provider.getAvailableProviderCount()).toBe(0);
    });

    it('returns empty extension statuses map', () => {
      const statuses = provider.getExtensionStatuses();
      expect(statuses instanceof Map).toBe(true);
      expect(statuses.size).toBe(0);
    });
  });

  describe('setCwd', () => {
    it('accepts new cwd without throwing', () => {
      expect(() => provider.setCwd('/new/path')).not.toThrow();
    });
  });

  describe('extension statuses', () => {
    it('setExtensionStatus adds or updates status', () => {
      provider.setExtensionStatus('ext1', 'active');
      expect(provider.getExtensionStatuses().get('ext1')).toBe('active');
    });

    it('setExtensionStatus with undefined removes entry', () => {
      provider.setExtensionStatus('ext1', 'active');
      provider.setExtensionStatus('ext1', undefined);
      expect(provider.getExtensionStatuses().has('ext1')).toBe(false);
    });

    it('clearExtensionStatuses empties map', () => {
      provider.setExtensionStatus('ext1', 'active');
      provider.setExtensionStatus('ext2', 'inactive');
      provider.clearExtensionStatuses();
      expect(provider.getExtensionStatuses().size).toBe(0);
    });

    it('getExtensionStatuses returns independent copy', () => {
      provider.setExtensionStatus('ext1', 'active');
      const copy = provider.getExtensionStatuses();
      copy.delete('ext1');
      expect(provider.getExtensionStatuses().has('ext1')).toBe(true);
    });
  });

  describe('available provider count', () => {
    it('setAvailableProviderCount updates count', () => {
      provider.setAvailableProviderCount(42);
      expect(provider.getAvailableProviderCount()).toBe(42);
    });

    it('default is 0', () => {
      expect(provider.getAvailableProviderCount()).toBe(0);
    });
  });

  describe('listener management', () => {
    it('onBranchChange returns an unsubscribe function', () => {
      const cb = jest.fn();
      const unsubscribe = provider.onBranchChange(cb);
      expect(typeof unsubscribe).toBe('function');
    });

    it('unsubscribe can be called without error', () => {
      const cb = jest.fn();
      const unsubscribe = provider.onBranchChange(cb);
      expect(() => unsubscribe()).not.toThrow();
    });

    it('dispose clears listeners set (no crash on subsequent onBranchChange)', () => {
      const cb = jest.fn();
      provider.dispose();
      // After dispose, should still be able to register new listener
      expect(() => provider.onBranchChange(cb)).not.toThrow();
    });

    it('dispose does not affect other state', () => {
      provider.setExtensionStatus('ext', 'status');
      provider.dispose();
      expect(provider.getExtensionStatuses().get('ext')).toBe('status');
    });
  });

  describe('dispose', () => {
    it('can be called multiple times safely', () => {
      provider.dispose();
      expect(() => provider.dispose()).not.toThrow();
    });
  });
});
