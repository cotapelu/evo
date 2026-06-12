import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCapabilityRegistry, resetCapabilityRegistry } from "../../extensions/capability-system/registry";

describe("Security & System Plugin Capabilities", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetCapabilityRegistry();
    const { default: capabilitySystemExtension } = await import("../../extensions/capability-system/extension.js");
    const api = { registerTool: vi.fn(), registerCommand: vi.fn() };
    await capabilitySystemExtension(api);
  });

  describe("security.scan", () => {
    it("should scan default path (cwd)", async () => {
      const mockExec = vi.fn().mockResolvedValue({
        code: 0,
        stdout: "No secrets found",
        stderr: ""
      });

      const registry = getCapabilityRegistry();
      const cap = registry.get("security.scan");
      const result = await cap.execute("test-id", {}, null, null, { cwd: "/project", exec: mockExec } as any);

      expect(result.isError).toBe(false);
      expect(mockExec).toHaveBeenCalledWith("npx", ["secret-scanner", "--path", "/project"], expect.any(Object));
    });

    it("should scan custom path", async () => {
      const mockExec = vi.fn().mockResolvedValue({ code: 0, stdout: "Scan complete", stderr: "" });

      const registry = getCapabilityRegistry();
      const cap = registry.get("security.scan");
      await cap.execute("test-id", { path: "/src" }, null, null, { cwd: "/project", exec: mockExec } as any);

      expect(mockExec).toHaveBeenCalledWith("npx", ["secret-scanner", "--path", "/src"], expect.any(Object));
    });
  });

  describe("system.metrics", () => {
    it("should return system metrics JSON", async () => {
      const mockExec = vi.fn().mockResolvedValue({
        code: 0,
        stdout: JSON.stringify({ uptime: 12345, memory: { heapUsed: 12345678 } }),
        stderr: ""
      });

      const registry = getCapabilityRegistry();
      const cap = registry.get("system.metrics");
      const result = await cap.execute("test-id", {}, null, null, { cwd: "/project", exec: mockExec } as any);

      expect(result.isError).toBe(false);
      expect(result.details?.uptime).toBe(12345);
    });

    it("should handle parse errors gracefully", async () => {
      const mockExec = vi.fn().mockResolvedValue({
        code: 0,
        stdout: "not json",
        stderr: ""
      });

      const registry = getCapabilityRegistry();
      const cap = registry.get("system.metrics");
      const result = await cap.execute("test-id", {}, null, null, { cwd: "/project", exec: mockExec } as any);

      expect(result.isError).toBe(false);
      expect(result.details?.raw).toBe("not json");
    });
  });
});
