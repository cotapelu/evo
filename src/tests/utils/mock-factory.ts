import { vi } from "vitest";
// Types are omitted to allow flexible mock usage (properties like .mock)

/**
 * Creates a mock ExtensionAPI with optional overrides.
 */
export function createMockExtensionAPI(overrides?: any): any {
  return {
    on: vi.fn(),
    registerTool: vi.fn(),
    registerCommand: vi.fn(),
    tui: {
      addChild: vi.fn(),
      removeChild: vi.fn(),
      requestRender: vi.fn(),
    } as any,
    getContext: vi.fn(() => createMockContext()),
    ...overrides,
  } as any;
}

/**
 * Creates a mock TeamRegistry with optional overrides.
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
  } as any;
}

/**
 * Creates a mock ExtensionContext with optional overrides.
 */
export function createMockContext(overrides?: any): any {
  const base: ExtensionContext = {
    cwd: process.cwd(),
    ui: {
      setWidget: vi.fn(),
      theme: { fg: () => "", bg: () => "", bold: () => "" } as any,
    },
    getContext: vi.fn(() => base),
    registerCommand: vi.fn(),
  } as any;
  return { ...base, ...overrides };
}
