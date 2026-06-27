#!/usr/bin/env node
/**
 * Team Widget Coverage Expansion
 *
 * Targets low-coverage areas in team-widget.ts by testing:
 * - refreshWidget with team data scenarios
 * - buildTeamLines edge cases (empty agents, all completed, failed tasks)
 * - Error handling during refresh
 * - Widget lifecycle (start/stop)
 * - Multiple teams rendering
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  getTeamWidgetEnabled, 
  toggleTeamWidget, 
  registerTeamWidget,
  startWidget,
  stopWidget,
  buildHeaderLines,
  buildTeamLines
} from "@extensions/team/team-widget.js";
import type { ExtensionAPI, ExtensionUIContext, Theme } from "@earendil-works/pi-coding-agent";

// Mock TeamRegistry - must be before importing module
let mockGetAll: any;
let mockGetTeamStatus: any;

vi.mock('@extensions/team/team-manager.js', async () => {
  const actual = await vi.importActual<any>('@extensions/team/team-manager.js');
  return {
    ...actual,
    TeamRegistry: {
      getInstance: vi.fn(() => ({
        getAll: mockGetAll,
        getTeamStatus: mockGetTeamStatus,
      }))
    }
  };
});

// Helper to create UI mock
function createMockUI(): ExtensionUIContext {
  return {
    setWidget: vi.fn(),
    theme: { fg: (color: string, text: string) => text } as Theme,
    custom: vi.fn(),
    notify: vi.fn(),
    isStdoutTTY: vi.fn().mockReturnValue(true),
    canChangeSize: vi.fn().mockReturnValue(true),
    getSize: vi.fn().mockReturnValue({ rows: 24, cols: 80 }),
  };
}

function createMockContext(ui?: ExtensionUIContext): any {
  return {
    ui: ui || createMockUI(),
    cwd: process.cwd(),
    exec: vi.fn(),
    signal: undefined,
    isIdle: vi.fn().mockReturnValue(true),
    isProjectTrusted: vi.fn().mockReturnValue(true),
    mode: 'tui' as const,
    hasUI: true,
    sessionManager: {
      getCurrentSession: vi.fn(),
      getSession: vi.fn(),
      getAllSessions: vi.fn(),
      listSessions: vi.fn(),
      create: vi.fn(),
      load: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      subscribe: vi.fn(),
      getDirtySessions: vi.fn(),
      getActiveSession: vi.fn(),
      getOrCreateActiveSession: vi.fn(),
      setActiveSession: vi.fn(),
      replaceActiveSession: vi.fn(),
      clearActiveSession: vi.fn(),
      cloneActiveSession: vi.fn(),
      saveActiveSession: vi.fn(),
      startCompaction: vi.fn(),
      getCompactionQueue: vi.fn(),
      setCompactionThresholds: vi.fn(),
      getCompactionThresholds: vi.fn(),
      setAutoCompact: vi.fn(),
      getAutoCompact: vi.fn(),
      startAutoCompactTimer: vi.fn(),
      stopAutoCompactTimer: vi.fn(),
      getSessionFilePath: vi.fn(),
      getSessionsDir: vi.fn(),
      getSessionsInfo: vi.fn(),
      getSessionInfo: vi.fn(),
      getSessionVersion: vi.fn(),
      migrate: vi.fn(),
      getMigrationNeeded: vi.fn(),
      resetSession: vi.fn(),
      clearAllSessions: vi.fn(),
    } as any,
    modelRegistry: { getAll: vi.fn().mockReturnValue([]) } as any,
    model: undefined,
  };
}

function createMockTeamStatus(overrides: Partial<{
  agents: Array<{ id: string; currentTaskIndex: number | null; status: string }>;
  tasks: Array<{ index: number; assignee: string | null; status: string; result: string; retryCount: number; retryAvailableAt?: number }>;
  completedTasks: number;
  failedTasks: number;
  pendingTasks: number;
  totalTasks: number;
  isComplete: boolean;
}> = {}): any {
  return {
    agents: overrides.agents || [],
    tasks: overrides.tasks || [],
    completedTasks: overrides.completedTasks ?? 0,
    failedTasks: overrides.failedTasks ?? 0,
    pendingTasks: overrides.pendingTasks ?? 0,
    totalTasks: overrides.totalTasks ?? 0,
    isComplete: overrides.isComplete ?? false,
  };
}

describe("Team Widget Coverage", () => {
  let mockApi: ExtensionAPI;
  let mockCtx: any;
  let sessionStartHandler: Function;
  let sessionShutdownHandlers: Function[] = [];

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetAll = vi.fn().mockReturnValue(new Map());
    mockGetTeamStatus = vi.fn().mockResolvedValue(createMockTeamStatus());
    
    mockApi = {
      on: vi.fn((event: string, handler: Function) => {
        if (event === 'session_start') {
          sessionStartHandler = handler;
        } else if (event === 'session_shutdown') {
          sessionShutdownHandlers.push(handler);
        } else if (event === 'before_provider_request' || event === 'after_provider_response' || event === 'before_agent_start' || event === 'agent_start' || event === 'agent_end' || event === 'turn_start' || event === 'turn_end' || event === 'message_start' || event === 'message_update' || event === 'message_end' || event === 'tool_execution_start' || event === 'tool_execution_update' || event === 'tool_execution_end') {
          // other events - no-op
        }
      }),
      registerTool: vi.fn(),
      registerCommand: vi.fn(),
      registerShortcut: vi.fn(),
      registerFlag: vi.fn(),
      getFlag: vi.fn(),
      registerMessageRenderer: vi.fn(),
      sendMessage: vi.fn(),
      sendUserMessage: vi.fn(),
      appendEntry: vi.fn(),
      setSessionName: vi.fn(),
      getSessionName: vi.fn(),
      setLabel: vi.fn(),
      exec: vi.fn(),
      getActiveTools: vi.fn().mockReturnValue([]),
      getAllTools: vi.fn().mockReturnValue([]),
      setActiveTools: vi.fn(),
      getCommands: vi.fn().mockReturnValue([]),
      setModel: vi.fn(),
      getThinkingLevel: vi.fn().mockReturnValue(1),
      setThinkingLevel: vi.fn(),
      registerProvider: vi.fn(),
    } as unknown as ExtensionAPI;

    registerTeamWidget(mockApi);
    
    // Simulate session start to initialize state
    mockCtx = createMockContext();
    await sessionStartHandler(null, mockCtx);
  });

  afterEach(() => {
    vi.clearAllMocks();
    sessionShutdownHandlers = [];
  });

  describe("buildHeaderLines", () => {
    it("returns header with accent and spacer", () => {
      const theme = { fg: (color: string, text: string) => `${color}:${text}` } as Theme;
      const lines = buildHeaderLines(theme);
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain("accent");
      expect(lines[0]).toContain("Team");
      expect(lines[1]).toBe("");
    });
  });

  describe("buildTeamLines", () => {
    it("formats team with mixed agent statuses", () => {
      const ui = createMockUI();
      const status: any = createMockTeamStatus({
        agents: [
          { id: 'agent-1', currentTaskIndex: 0, status: 'idle' },
          { id: 'agent-2', currentTaskIndex: 1, status: 'working' },
          { id: 'agent-3', currentTaskIndex: 2, status: 'in_progress' },
        ],
        tasks: [],
        completedTasks: 2,
        pendingTasks: 1,
        failedTasks: 0,
        totalTasks: 3,
      });
      
      const lines = buildTeamLines(ui, 'team-abc123', status);
      
      expect(lines.some(l => l.includes('Team abc123'))).toBe(true);
      expect(lines.some(l => l.includes('Tasks: 2/3'))).toBe(true);
      expect(lines.some(l => l.includes('Agents: 3'))).toBe(true);
      expect(lines.some(l => l.includes('idle: 1'))).toBe(true);
      expect(lines.some(l => l.includes('working: 2'))).toBe(true);
    });

    it("handles zero agents and zero tasks", () => {
      const ui = createMockUI();
      const status: any = createMockTeamStatus({
        agents: [],
        tasks: [],
        completedTasks: 0,
        pendingTasks: 0,
        failedTasks: 0,
        totalTasks: 0,
      });
      
      const lines = buildTeamLines(ui, 'team-empty', status);
      
      expect(lines.some(l => l.includes('Agents: 0'))).toBe(true);
      expect(lines.some(l => l.includes('Tasks: 0/0'))).toBe(true);
    });

    it("handles all tasks completed", () => {
      const ui = createMockUI();
      const status: any = createMockTeamStatus({
        agents: [{ id: 'a1', currentTaskIndex: null, status: 'idle' }],
        tasks: [
          { index: 0, assignee: 'a1', status: 'completed', result: 'ok', retryCount: 0 },
          { index: 1, assignee: 'a1', status: 'completed', result: 'done', retryCount: 0 },
        ],
        completedTasks: 2,
        pendingTasks: 0,
        failedTasks: 0,
        totalTasks: 2,
        isComplete: true,
      });
      
      const lines = buildTeamLines(ui, 'team-done', status);
      
      expect(lines.some(l => l.includes('Tasks: 2/2'))).toBe(true);
      expect(lines.some(l => l.includes('pending: 0'))).toBe(true);
    });

    it("handles failed tasks with retry count", () => {
      const ui = createMockUI();
      const status: any = createMockTeamStatus({
        agents: [{ id: 'a1', currentTaskIndex: 0, status: 'idle' }],
        tasks: [
          { index: 0, assignee: 'a1', status: 'failed', result: 'error', retryCount: 2, retryAvailableAt: Date.now() + 1000 },
        ],
        completedTasks: 0,
        pendingTasks: 0,
        failedTasks: 1,
        totalTasks: 1,
      });
      
      const lines = buildTeamLines(ui, 'team-fail', status);
      
      expect(lines.some(l => l.includes('failed: 1'))).toBe(true);
    });

    it("handles working and in_progress as working", () => {
      const ui = createMockUI();
      const status: any = createMockTeamStatus({
        agents: [
          { id: 'a1', currentTaskIndex: 0, status: 'idle' },
          { id: 'a2', currentTaskIndex: 1, status: 'working' },
          { id: 'a3', currentTaskIndex: 2, status: 'in_progress' },
        ],
        tasks: [],
        completedTasks: 0,
        pendingTasks: 0,
        failedTasks: 0,
        totalTasks: 0,
      });
      
      const lines = buildTeamLines(ui, 'team-active', status);
      
      // Should count both 'working' and 'in_progress' as working
      expect(lines.some(l => l.includes('working: 2'))).toBe(true);
    });

    it("handles agent with null currentTaskIndex", () => {
      const ui = createMockUI();
      const status: any = createMockTeamStatus({
        agents: [
          { id: 'a1', currentTaskIndex: null, status: 'idle' },
          { id: 'a2', currentTaskIndex: 5, status: 'working' },
        ],
        tasks: [],
        completedTasks: 0,
        pendingTasks: 0,
        failedTasks: 0,
        totalTasks: 0,
      });
      
      const lines = buildTeamLines(ui, 'team-null', status);
      
      expect(lines.some(l => l.includes('Agents: 2'))).toBe(true);
    });
  });

  describe("toggle and state", () => {
    it("initial state enabled after session start", () => {
      expect(getTeamWidgetEnabled(mockCtx)).toBe(true);
    });

    it("toggles invert state based on initial", () => {
      const initial = getTeamWidgetEnabled(mockCtx);
      const s1 = toggleTeamWidget(mockCtx);
      const s2 = toggleTeamWidget(mockCtx);
      const s3 = toggleTeamWidget(mockCtx);
      expect(s3).toBe(!initial);
      expect(getTeamWidgetEnabled(mockCtx)).toBe(!initial);
    });

    it("stopWidget clears UI widget when toggling off", () => {
      const initialState = getTeamWidgetEnabled(mockCtx);
      expect(initialState).toBe(true);
      // Initial state setWidget call from session_start
      const initialCalls = mockCtx.ui.setWidget.mock.calls.length;
      
      toggleTeamWidget(mockCtx); // turn off
      
      expect(mockCtx.ui.setWidget).toHaveBeenCalledWith("team", undefined);
    });
  });

  describe("startWidget / stopWidget", () => {
    it("startWidget sets up interval and calls initial refresh", () => {
      const ctx = createMockContext();
      startWidget(ctx);
      
      // Should have called refreshWidget (which calls setWidget)
      expect(ctx.ui.setWidget).toHaveBeenCalled();
      
      const state = (ctx as any)['teamWidgetState'];
      expect(state).not.toBeNull();
      expect(state.intervalId).toBeDefined();
      
      stopWidget(state);
    });

    it("stopWidget clears interval and UI", () => {
      const ctx = createMockContext();
      startWidget(ctx);
      const state = (ctx as any)['teamWidgetState'];
      expect(state.intervalId).not.toBeNull();
      
      stopWidget(state);
      
      expect(state.intervalId).toBeNull();
      expect(ctx.ui.setWidget).toHaveBeenCalledWith("team", undefined);
    });

    it("startWidget is idempotent", () => {
      const ctx = createMockContext();
      startWidget(ctx);
      const state = (ctx as any)['teamWidgetState'];
      const interval1 = state.intervalId;
      
      startWidget(ctx); // call again
      const state2 = (ctx as any)['teamWidgetState'];
      
      expect(state2.intervalId).toBe(interval1);
      stopWidget(state2);
    });

    it("stopWidget is idempotent", () => {
      const ctx = createMockContext();
      startWidget(ctx);
      const state = (ctx as any)['teamWidgetState'];
      
      stopWidget(state);
      stopWidget(state); // call again
      
      expect(state.intervalId).toBeNull();
    });
  });

  describe("session lifecycle", () => {
    it("session_shutdown stops widget and clears reference", async () => {
      const ctx = createMockContext();
      startWidget(ctx);
      const state = (ctx as any)['teamWidgetState'];
      expect(state.intervalId).not.toBeNull();
      expect(state.ctx).toBe(ctx);
      
      // Simulate session shutdown
      for (const handler of sessionShutdownHandlers) {
        await handler(null, ctx);
      }
      
      expect(state.intervalId).toBeNull();
      expect(state.ctx).toBeNull();
      expect(ctx.ui.setWidget).toHaveBeenCalledWith("team", undefined);
    });
  });

  describe("refreshWidget with teams", () => {
    it("renders 'No active teams' when registry empty", async () => {
      const ui = createMockUI();
      const ctx = createMockContext(ui);
      
      // Need to init state
      (ctx as any)['teamWidgetState'] = { enabled: true, ctx, intervalId: null };
      
      await import("@extensions/team/team-widget.js").then(mod => {
        mod.refreshWidget(ui);
      });
      
      expect(ui.setWidget).toHaveBeenCalledWith(
        "team",
        expect.arrayContaining([expect.stringContaining("No active teams")])
      );
    });

    it("renders single team", async () => {
      const ui = createMockUI();
      const ctx = createMockContext(ui);
      (ctx as any)['teamWidgetState'] = { enabled: true, ctx, intervalId: null };
      
      mockGetAll.mockReturnValue(new Map([
        ['team-abc123', { getTeamStatus: mockGetTeamStatus } as any]
      ]));
      mockGetTeamStatus.mockResolvedValue(createMockTeamStatus({
        agents: [{ id: 'a1', status: 'idle' }],
        totalTasks: 5, completedTasks: 2, pendingTasks: 3, failedTasks: 0,
      }));
      
      await import("@extensions/team/team-widget.js").then(mod => {
        mod.refreshWidget(ui);
      });
      
      expect(ui.setWidget).toHaveBeenCalledWith(
        "team",
        expect.arrayContaining([
          expect.stringContaining("Team abc123"),
          expect.stringContaining("Tasks: 2/5"),
        ])
      );
    });

    it("handles team getTeamStatus rejection", async () => {
      const ui = createMockUI();
      const ctx = createMockContext(ui);
      (ctx as any)['teamWidgetState'] = { enabled: true, ctx, intervalId: null };
      
      mockGetAll.mockReturnValue(new Map([
        ['team-error', { getTeamStatus: vi.fn().mockRejectedValue(new Error("DB down")) } as any]
      ]));
      
      await import("@extensions/team/team-widget.js").then(mod => {
        mod.refreshWidget(ui);
      });
      
      expect(ui.setWidget).toHaveBeenCalledWith(
        "team",
        expect.arrayContaining([expect.stringContaining("error fetching status")])
      );
    });
  });

  describe("error boundaries", () => {
    it("refreshWidget catches setWidget exceptions", async () => {
      const ui = createMockUI();
      const ctx = createMockContext(ui);
      (ctx as any)['teamWidgetState'] = { enabled: true, ctx, intervalId: null };
      
      ui.setWidget = vi.fn().mockImplementation(() => { throw new Error("UI closed"); });
      
      // Should not throw
      await import("@extensions/team/team-widget.js").then(mod => {
        mod.refreshWidget(ui);
      });
    });

    it("startWidget catches refresh errors", () => {
      const ctx = createMockContext();
      const ui = ctx.ui;
      ui.setWidget = vi.fn().mockImplementation(() => { throw new Error("fail"); });
      
      // Should not throw
      startWidget(ctx);
      
      expect(ui.setWidget).toHaveBeenCalled();
    });
  });
});
