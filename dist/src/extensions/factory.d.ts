#!/usr/bin/env node
/**
 * Piclaw Extensions - Extension Function
 *
 * This function registers all custom extensions for Piclaw.
 * Exported as default extension function for factory creation.
 */
export default function extensionsAggregator(api: import("@earendil-works/pi-coding-agent").ExtensionAPI): void;
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