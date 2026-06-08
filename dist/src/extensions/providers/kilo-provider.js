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
import { KILO_MODELS_ALL } from "./models/index.js";
export function registerKiloProvider(api) {
    // Skip registration in e2e tests to use mock provider
    if (process.env.E2E_SKIP_KILO === '1')
        return;
    // Get baseUrl from generated models if available, otherwise use fallback
    const baseUrl = KILO_MODELS_ALL[0]?.baseUrl || "https://api.kilo.ai/api/gateway";
    const config = {
        baseUrl,
        apiKey: "$KILO_API_KEY",
        api: "openai-completions",
        models: KILO_MODELS_ALL,
    };
    api.registerProvider("kilo", config);
}
//# sourceMappingURL=kilo-provider.js.map