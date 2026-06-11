#!/usr/bin/env node
/**
 * OAuth Provider Registration Demo
 *
 * Demonstrates how to register a custom OAuth provider via api.registerProvider.
 * This demo registers a "demo-oauth" provider with stub OAuth methods.
 *
 * Real implementation would integrate with an actual OAuth service.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type {
	OAuthCredentials,
	OAuthProviderInterface,
	OAuthLoginCallbacks,
	Model,
	Api,
} from "@earendil-works/pi-ai";

// ============================================================================
// Demo OAuth Provider Implementation
// ============================================================================
const demoOAuthProvider: OAuthProviderInterface = {
	id: "demo-oauth",
	name: "Demo OAuth Provider",
	async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
		// In a real implementation, this would open a browser or device code flow.
		// For demo, we simulate a successful login with dummy tokens.
		console.log("[DemoOAuth] login() called");
		// Notify UI
		callbacks.onAuth?.({ url: "https://example.com/login (demo)" });
		// Simulate waiting for user action (in real scenario, this would wait)
		// Here we return mock credentials immediately.
		return {
			refresh: "demo-refresh-token",
			access: "demo-access-token",
			expires: Date.now() + 3600 * 1000, // 1 hour
			provider: "demo-oauth",
			scope: "demo",
		};
	},
	async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
		console.log("[DemoOAuth] refreshToken() called");
		// Return refreshed credentials with new expiry
		return {
			...credentials,
			expires: Date.now() + 3600 * 1000,
		};
	},
	getApiKey(credentials: OAuthCredentials): string {
		// Convert OAuth credentials to an API key string for the provider.
		return `demo-${credentials.access}`;
	},
	// Optional: modify models based on credentials
	modifyModels(models: Model<Api>[], credentials: OAuthCredentials): Model<Api>[] {
		console.log("[DemoOAuth] modifyModels() called");
		// Could adjust baseUrl or headers based on credentials
		return models;
	},
};

// ============================================================================
// Extension Registration
// ============================================================================
export function registerOAuthProviderExtension(api: ExtensionAPI): void {
	// Register the OAuth provider with the API registry
	// This adds it to the list of available providers.
	api.registerProvider("demo-oauth", {
		// Provider-level configuration
		name: "Demo OAuth",
		baseUrl: "https://demo.example.com",
		// Define a demo model with minimal required fields
		models: [
			{
				id: "demo-model-v1",
				name: "Demo Model v1",
				baseUrl: "https://demo.example.com",
				api: "faux" as any, // Use faux API type for demo
				reasoning: false,
				input: ["text"],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: 8192,
				maxTokens: 8192,
			} as any, // cast to any to satisfy full ProviderModelConfig
		],
		// Attach the OAuth provider implementation
		oauth: demoOAuthProvider,
	});

	// Optional: send a startup message
	api.sendMessage?.({
		customType: "oauth-provider-demo",
		content: "🔑 OAuth Provider Demo loaded – registered 'demo-oauth' provider",
		display: false,
	});
}

export default registerOAuthProviderExtension;
