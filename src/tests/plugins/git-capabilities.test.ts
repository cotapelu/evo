import { describe, it, expect, vi, beforeEach } from "vitest";

import { getCapabilityRegistry, resetCapabilityRegistry } from "@extensions/capability-system/registry";
import { PluginLoader } from "@extensions/capability-system/plugin-loader";
import { join } from "path";

describe("Git Plugin Capabilities", () => {
  let api: any;
  let loader: PluginLoader;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetCapabilityRegistry();
    api = { registerTool: vi.fn(), registerCommand: vi.fn() };
    // Load capability system
    const { default: capabilitySystemExtension } = await import("@extensions/capability-system/extension.js");
    await capabilitySystemExtension(api);

    // Get loader and load git plugin
    const { getGlobalLoader } = await import("@extensions/capability-system/plugin-loader.js");
    loader = getGlobalLoader()!;
    if (!loader) throw new Error("Loader not initialized");
  });

  describe("git.status", () => {
    it("should parse git status output correctly", async () => {
      // Mock exec in ctx
      const mockExec = vi.fn().mockResolvedValue({
        code: 0,
        stdout: `## main...origin/main\n M src/file.ts\nA  newfile.ts\n?? untracked.txt`,
        stderr: ""
      });

      const registry = getCapabilityRegistry();
      const cap = registry.get("git.status")!; // non-null

      const result = await cap.execute("test-id", {}, null, null, { cwd: "/repo", exec: mockExec } as any);

      expect(result.isError).toBe(false);
      expect(result.details?.branch).toBe("main");
      expect(result.details?.staged).toContain("A  newfile.ts");
      expect(result.details?.unstaged).toContain(" M src/file.ts");
      expect(result.details?.untracked).toContain("untracked.txt");
    });

    it("should handle git status error", async () => {
      const mockExec = vi.fn().mockResolvedValue({
        code: 1,
        stdout: "",
        stderr: "fatal: not a git repository"
      });

      const registry = getCapabilityRegistry();
      const cap = registry.get("git.status")!;
      const result = await cap.execute("test-id", {}, null, null, { cwd: "/", exec: mockExec } as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("git status failed");
    });
  });

  describe("git.diff", () => {
    it("should return diff output", async () => {
      const mockExec = vi.fn().mockResolvedValue({
        code: 0,
        stdout: "diff --git a/file.ts b/file.ts\n--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new",
        stderr: ""
      });

      const registry = getCapabilityRegistry();
      const cap = registry.get("git.diff")!;
      const result = await cap.execute("test-id", { revision: "HEAD~1" }, null, null, { cwd: "/repo", exec: mockExec } as any);

      expect(result.isError).toBe(false);
      expect(result.details?.revision).toBe("HEAD~1");
      expect(result.content[0].text).toContain("diff");
    });

    it("should use HEAD as default revision", async () => {
      const mockExec = vi.fn().mockResolvedValue({ code: 0, stdout: "diff HEAD", stderr: "" });

      const registry = getCapabilityRegistry();
      const cap = registry.get("git.diff")!;
      await cap.execute("test-id", {}, null, null, { cwd: "/repo", exec: mockExec } as any);

      expect(mockExec).toHaveBeenCalledWith("git", expect.arrayContaining(["diff", "HEAD", "--color=never"]), expect.any(Object));
    });
  });

  describe("git.commit", () => {
    it("should commit with message", async () => {
      const mockExec = vi.fn().mockResolvedValue({
        code: 0,
        stdout: "[main abc123] feat: add login",
        stderr: ""
      });

      const registry = getCapabilityRegistry();
      const cap = registry.get("git.commit")!;
      const result = await cap.execute("test-id", { message: "feat: add login" }, null, null, { cwd: "/repo", exec: mockExec } as any);

      expect(result.isError).toBe(false);
      expect(mockExec).toHaveBeenCalledWith("git", ["commit", "-m", "feat: add login"], expect.any(Object));
    });

    it("should commit -a if all=true", async () => {
      const mockExec = vi.fn().mockResolvedValue({ code: 0, stdout: "committed", stderr: "" });

      const registry = getCapabilityRegistry();
      const cap = registry.get("git.commit")!;
      await cap.execute("test-id", { message: "fix: bug", all: true }, null, null, { cwd: "/repo", exec: mockExec } as any);

      expect(mockExec).toHaveBeenCalledWith("git", ["commit", "-a", "-m", "fix: bug"], expect.any(Object));
    });
  });
});
