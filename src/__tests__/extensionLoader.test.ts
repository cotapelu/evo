import { getResourceLoaderOptions } from '../extensions/index.js';

describe('Extension Loader', () => {
  test('getResourceLoaderOptions returns options with extensionFactories', () => {
    const opts = getResourceLoaderOptions();
    expect(opts).toHaveProperty('extensionFactories');
    expect(Array.isArray(opts.extensionFactories)).toBe(true);
  });
});