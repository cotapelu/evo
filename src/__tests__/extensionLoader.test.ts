import { getExtensionFactories } from '../extensions/index.js';

describe('Extension Loader', () => {
  test('getExtensionFactories returns array of extension factories', () => {
    const factories = getExtensionFactories();
    expect(Array.isArray(factories)).toBe(true);
    expect(factories.length).toBeGreaterThan(0);
  });
});