#!/usr/bin/env node
/**
 * Piclaw Extensions - Extension Function
 *
 * This function registers all custom extensions for Piclaw.
 * Exported as default extension function for factory creation.
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
export default function extensionsAggregator(api: ExtensionAPI): void;
/**
 * Extension Configuration
 */
export declare function getExtensionFactories(): (typeof extensionsAggregator)[];
export declare function getResourceLoaderOptions(): {
    extensionFactories: (typeof extensionsAggregator)[];
};
export { extensionsAggregator };
type ExtensionsAggregator = typeof extensionsAggregator;
export type { ExtensionsAggregator };
//# sourceMappingURL=factory.d.ts.map