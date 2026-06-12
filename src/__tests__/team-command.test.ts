import { vi, describe, it, expect, beforeEach } from "vitest";
import { registerTeamCommand } from "../extensions/commands/team-command.js";
import { createMockExtensionAPI } from "../tests/utils/mock-factory.js";
import { toggleTeamWidget, getTeamWidgetEnabled } from "../extensions/team/team-widget.js";

// Mock team-widget module functions are already imported
vi.mock("../extensions/team/team-widget.js", () => ({
  registerTeamWidget: vi.fn(),
  toggleTeamWidget: vi.fn(),
  getTeamWidgetEnabled: vi.fn(),
}));

const mockNotify = vi.fn();

const createMockCtx = () => ({
  ui: {
    notify: mockNotify,
  },
});

const createMockApi = () => createMockExtensionAPI();

describe("Team Command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerTeamCommand", () => {
    it("should register command with correct name", () => {
      const api = createMockApi();
      registerTeamCommand(api);
      expect(api.registerCommand).toHaveBeenCalledWith("team", expect.any(Object));
    });

    it("should toggle team widget and notify", async () => {
      (getTeamWidgetEnabled as any).mockReturnValue(false);
      (toggleTeamWidget as any).mockReturnValue(true);

      const api = createMockApi();
      registerTeamCommand(api);
      const ctx = createMockCtx();

      const handler = api.registerCommand.mock.calls[0][1].handler;
      await handler("", ctx);

      expect(toggleTeamWidget).toHaveBeenCalled();
      expect(mockNotify).toHaveBeenCalledWith("Team widget shown", "info");
    });

    it("should handle toggle to false", async () => {
      (getTeamWidgetEnabled as any).mockReturnValue(true);
      (toggleTeamWidget as any).mockReturnValue(false);

      const api = createMockApi();
      registerTeamCommand(api);
      const ctx = createMockCtx();

      const handler = api.registerCommand.mock.calls[0][1].handler;
      await handler("", ctx);

      expect(toggleTeamWidget).toHaveBeenCalled();
      expect(mockNotify).toHaveBeenCalledWith("Team widget hidden", "info");
    });

    it("should work without arguments", async () => {
      const api = createMockApi();
      registerTeamCommand(api);
      const ctx = createMockCtx();

      const handler = api.registerCommand.mock.calls[0][1].handler;
      await handler("", ctx);

      expect(toggleTeamWidget).toHaveBeenCalled();
    });

    it("should ignore arguments", async () => {
      const api = createMockApi();
      registerTeamCommand(api);
      const ctx = createMockCtx();

      const handler = api.registerCommand.mock.calls[0][1].handler;
      await handler("on", ctx); // extra arg should be ignored

      expect(toggleTeamWidget).toHaveBeenCalled();
    });
  });
});
