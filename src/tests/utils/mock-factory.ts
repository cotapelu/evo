import { vi } from "vitest";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

/**
 * Creates a mock ExtensionAPI with optional overrides.
 * Returns a typed object to reduce `any` casts in tests.
 */
export function createMockExtensionAPI(overrides?: Partial<ExtensionAPI>): ExtensionAPI {
  const api: ExtensionAPI = {
    on: vi.fn(),
    registerTool: vi.fn(),
    registerCommand: vi.fn(),
    // @ts-ignore
    tui: {
      addChild: vi.fn(),
      removeChild: vi.fn(),
      requestRender: vi.fn(),
    },
    getContext: vi.fn(() => createMockContext()),
    ...overrides,
  } as ExtensionAPI;
  return api;
}

/**
 * Creates a mock TeamRegistry with optional overrides.
 * Kept as any due to complex type, but centralize here.
 */
export function createMockTeamRegistry(overrides?: any): any {
  return {
    getAll: vi.fn(() => new Map()),
    get: vi.fn(),
    listByTag: vi.fn(),
    listAll: vi.fn(),
    listByPlugin: vi.fn(),
    search: vi.fn(),
    has: vi.fn(),
    unregister: vi.fn(() => false),
    getSystemPromptSection: vi.fn(() => ""),
    getCapabilityIds: vi.fn(() => []),
    ...overrides,
  };
}

/**
 * Creates a mock ExtensionContext with optional overrides.
 */
export function createMockContext(overrides: Partial<ExtensionContext> = {}): ExtensionContext {
  const base: ExtensionContext = {
    cwd: process.cwd(),
    ui: {
      setWidget: vi.fn(),
      // @ts-ignore
      theme: { fg: () => "", bg: () => "", bold: () => "" },
    },
    getContext: vi.fn(() => base),
    registerCommand: vi.fn(),
  } as ExtensionContext;
  return { ...base, ...overrides };
}
