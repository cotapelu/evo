#!/usr/bin/env node
/**
 * Kilo Provider Registration
 *
 * Registers Kilo Gateway as an API key provider.
 * Users can authenticate via /login → "Use an API key" → kilo.
 *
 * Environment variable: $KILO_API_KEY (or KILO_API_KEY)
 * API endpoint: https://api.kilo.ai/v1
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export declare function registerKiloProvider(api: ExtensionAPI): void;
//# sourceMappingURL=kilo-provider.d.ts.map