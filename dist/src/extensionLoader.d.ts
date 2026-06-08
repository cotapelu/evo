/**
 * Extension Configuration
 *
 * Cấu hình extensions cho AgentSessionServices
 */
import extensionsAggregator from './extensions/index.js';
/**
 * Trả về extension factories cho resourceLoaderOptions
 */
export declare function getExtensionFactories(): (typeof extensionsAggregator)[];
/**
 * Trả về resourceLoaderOptions hoàn chỉnh
 */
export declare function getResourceLoaderOptions(): {
    extensionFactories: (typeof extensionsAggregator)[];
};
//# sourceMappingURL=extensionLoader.d.ts.map