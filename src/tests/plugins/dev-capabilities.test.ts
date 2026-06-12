import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockExtensionAPI, createMockContext } from "../utils/mock-factory.js";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getCapabilityRegistry, resetCapabilityRegistry } from "@extensions/capability-system/registry";
import { PluginLoader } from "@extensions/capability-system/plugin-loader";

describe("Dev Plugin Capabilities", () => {
  let loader: PluginLoader;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetCapabilityRegistry();
    const { default: capabilitySystemExtension } = await import("@extensions/capability-system/extension.js");
    const api = createMockExtensionAPI();
    await capabilitySystemExtension(api);

    const { getGlobalLoader } = await import("@extensions/capability-system/plugin-loader.js");
    loader = getGlobalLoader()!;
    if (!loader) throw new Error("Loader not initialized");
  });

  describe("dev.test", () => {
    it("should run npm test", async () => {
      const mockExec = vi.fn().mockResolvedValue({
        code: 0,
        stdout: "PASS src/foo.test.ts\n\nTest Files  1 passed",
        stderr: ""
      });

      const registry = getCapabilityRegistry();
      const cap = registry.get("dev.test")!;
      const ctx = createMockContext({ cwd: "/project", exec: mockExec });
      const result = await cap.execute("test-id", {}, null, null, ctx);

      expect(result.isError).toBe(false);
      expect(mockExec).toHaveBeenCalledWith("bash", expect.arrayContaining(["-c", "npm test"]), expect.any(Object));
    });

    it("should pass files to test command", async () => {
      const mockExec = vi.fn().mockResolvedValue({ code: 0, stdout: "ok", stderr: "" });

      const registry = getCapabilityRegistry();
      const cap = registry.get("dev.test")!;
      const ctx = createMockContext({ cwd: "/project", exec: mockExec });
      await cap.execute("test-id", { files: ["src/foo.test.ts", "src/bar.test.ts"] }, null, null, ctx);

      expect(mockExec).toHaveBeenCalledWith("bash", expect.arrayContaining(["-c", `npm test -- "src/foo.test.ts" "src/bar.test.ts"`]), expect.any(Object));
    });
  });

  describe("dev.format", () => {
    it("should format files with prettier", async () => {
      const mockExec = vi.fn().mockResolvedValue({
        code: 0,
        stdout: "src/file.ts formatted",
        stderr: ""
      });

      const registry = getCapabilityRegistry();
      const cap = registry.get("dev.format")!;
      const ctx = createMockContext({ cwd: "/project", exec: mockExec });
      const result = await cap.execute("test-id", { files: ["src/index.ts", "lib/util.ts"] }, null, null, ctx);

      expect(result.isError).toBe(false);
      expect(mockExec).toHaveBeenCalledWith("npx", ["prettier", "--write", "src/index.ts", "lib/util.ts"], expect.any(Object));
    });
  });

  describe("dev.audit", () => {
    it("should run npm audit", async () => {
      const mockExec = vi.fn().mockResolvedValue({
        code: 0,
        stdout: "found 0 vulnerabilities",
        stderr: ""
      });

      const registry = getCapabilityRegistry();
      const cap = registry.get("dev.audit")!;
      const ctx = createMockContext({ cwd: "/project", exec: mockExec });
      const result = await cap.execute("test-id", {}, null, null, ctx);

      expect(result.isError).toBe(false);
      expect(mockExec).toHaveBeenCalledWith("npm", ["audit"], expect.any(Object));
    });

    it("should pass fix flag", async () => {
      const mockExec = vi.fn().mockResolvedValue({ code: 0, stdout: "fixed", stderr: "" });

      const registry = getCapabilityRegistry();
      const cap = registry.get("dev.audit")!;
      const ctx = createMockContext({ cwd: "/project", exec: mockExec });
      await cap.execute("test-id", { fix: true }, null, null, ctx);

      expect(mockExec).toHaveBeenCalledWith("npm", ["audit", "--", "fix"], expect.any(Object));
    });
  });

  describe("dev.build", () => {
    it("should run npm run build", async () => {
      const mockExec = vi.fn().mockResolvedValue({
        code: 0,
        stdout: "> evo@0.0.1 build\nTSUP...",
        stderr: ""
      });

      const registry = getCapabilityRegistry();
      const cap = registry.get("dev.build")!;
      const ctx = createMockContext({ cwd: "/project", exec: mockExec });
      const result = await cap.execute("test-id", {}, null, null, ctx);

      expect(result.isError).toBe(false);
      expect(mockExec).toHaveBeenCalledWith("npm", ["run", "build"], expect.any(Object));
    });
  });

  describe("dev.scripts", () => {
    it("should list npm scripts", async () => {
      const mockExec = vi.fn().mockResolvedValue({
        code: 0,
        stdout: "Lifecycle Scripts:\nbuild\nstart\ntest",
        stderr: ""
      });

      const registry = getCapabilityRegistry();
      const cap = registry.get("dev.scripts")!;
      const ctx = createMockContext({ cwd: "/project", exec: mockExec });
      const result = await cap.execute("test-id", { action: "list" }, null, null, ctx);

      expect(result.isError).toBe(false);
      expect(mockExec).toHaveBeenCalledWith("npm", ["run"], expect.any(Object));
    });

    it("should run a specific script", async () => {
      const mockExec = vi.fn().mockResolvedValue({ code: 0, stdout: "starting...", stderr: "" });

      const registry = getCapabilityRegistry();
      const cap = registry.get("dev.scripts")!;
      const ctx = createMockContext({ cwd: "/project", exec: mockExec });
      await cap.execute("test-id", { action: "run", script: "start" }, null, null, ctx);

      expect(mockExec).toHaveBeenCalledWith("npm", ["run", "start"], expect.any(Object));
    });

    it("should error if script missing for run action", async () => {
      const registry = getCapabilityRegistry();
      const cap = registry.get("dev.scripts")!;
      const execMock = vi.fn();
      const ctx = createMockContext({ cwd: "/project", exec: execMock });
      const result = await cap.execute("test-id", { action: "run" }, null, null, ctx);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("script required");
    });
  });
});
