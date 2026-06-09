/**
 * Extensions Module - Central Entry Point
 *
 * Re-exports from factory.ts
 */

export {
  extensionsAggregator,
  getExtensionFactories,
} from './factory.js';

// Default export để hỗ trợ: import extensions from './extensions'
export { extensionsAggregator as default } from './factory.js';
