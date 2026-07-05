import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock TeamRegistry before importing the module under test
vi.mock('../../../extensions/team/team-manager.js', () => ({
  TeamRegistry: class TeamRegistry {
    static instance: any;
    static getInstance() {
      if (!TeamRegistry.instance) TeamRegistry.instance = new TeamRegistry();
      return TeamRegistry.instance;
    }
    teams: Map<string, any>;
    constructor() {
      this.teams = new Map();
    }
    getAll() {
      return this.teams;
    }
  }
}));

// Now import the functions to test
import {
  buildHeaderLines,
  buildTeamLines,
  refreshWidget,
  startWidget,
  stopWidget,
  toggleTeamWidget,
  getTeamWidgetEnabled,
  ensureState,
  registerTeamWidget
} from '../../../extensions/team/team-widget.ts';

// Also import TeamRegistry to manipulate in tests
import { TeamRegistry } from '../../../extensions/team/team-manager.js';

const mockTheme = {
  fg: (color: string, value: string) => value,
  // .bold() on string returns <b>...</b>, but we only check substring.
};

const mockUI = {
  setWidget: vi.fn(),
  theme: mockTheme,
};

const createMockContext = () => {
  const ctx: any = { ui: mockUI, on: vi.fn() };
  return ctx;
};

describe('Team Widget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TeamRegistry.getInstance().teams.clear();
    mockUI.setWidget.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('buildHeaderLines', () => {
    it('returns header with accent text and blank line', () => {
      const lines = buildHeaderLines(mockTheme);
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain('👥 Team');
      expect(lines[1]).toBe('');
    });
  });

  describe('buildTeamLines', () => {
    it('formats team status with correct counts and short ID', () => {
      const status = {
        agents: [
          { id: 'agent-1', status: 'idle', currentTaskIndex: null },
          { id: 'agent-2', status: 'working', currentTaskIndex: 0 },
          { id: 'agent-3', status: 'in_progress', currentTaskIndex: 1 }
        ],
        tasks: [],
        completedTasks: 2,
        failedTasks: 0,
        pendingTasks: 3,
        totalTasks: 5,
        isComplete: false
      };
      const lines = buildTeamLines({ theme: mockTheme } as any, 'team-abc', status);
      const text = lines.join('\n');
      // shortId = 'team-abc'.slice(-6) = 'am-abc'
      expect(text).toContain('Team am-abc');
      expect(text).toContain('Tasks: 2/5 (pending: 3, failed: 0)');
      expect(text).toContain('Agents: 3 (idle: 1, working: 2)');
    });

    it('handles empty agents', () => {
      const status = {
        agents: [],
        tasks: [],
        completedTasks: 0,
        failedTasks: 0,
        pendingTasks: 0,
        totalTasks: 0,
        isComplete: true
      };
      const lines = buildTeamLines({ theme: mockTheme } as any, 'team-short', status);
      const text = lines.join('\n');
      // 'team-short'.slice(-6) = '-short'
      expect(text).toContain('Team -short');
      expect(text).toContain('Agents: 0 (idle: 0, working: 0)');
    });
  });

  describe('refreshWidget', () => {
    it('shows "No active teams" when registry empty', async () => {
      await refreshWidget({ theme: mockTheme, setWidget: mockUI.setWidget } as any);
      // Since setWidget is called asynchronously via microtask, flush
      await Promise.resolve();
      expect(mockUI.setWidget).toHaveBeenCalledWith('team', expect.arrayContaining([expect.stringContaining('No active teams')]));
    });

    it('refreshes widget with aggregated team statuses', async () => {
      const registry = TeamRegistry.getInstance();
      const team1 = { getTeamStatus: vi.fn().mockResolvedValue({
        agents: [{ id: 'a1', status: 'idle' }],
        tasks: [],
        completedTasks: 1,
        failedTasks: 0,
        pendingTasks: 2,
        totalTasks: 3,
        isComplete: false
      })};
      const team2 = { getTeamStatus: vi.fn().mockResolvedValue({
        agents: [{ id: 'a2', status: 'working' }],
        tasks: [],
        completedTasks: 0,
        failedTasks: 1,
        pendingTasks: 0,
        totalTasks: 1,
        isComplete: true
      })};
      registry.teams.set('team1', team1);
      registry.teams.set('team2', team2);

      await refreshWidget({ theme: mockTheme, setWidget: mockUI.setWidget } as any);
      await Promise.resolve(); // flush microtasks

      expect(mockUI.setWidget).toHaveBeenCalledWith('team', expect.any(Array));
      const linesArg = mockUI.setWidget.mock.calls[0][1];
      const fullText = linesArg.join('\n');
      // actual short IDs
      expect(fullText).toContain('Team team1'); // 'team1'.slice(-6) => 'team1'
      expect(fullText).toContain('Team team2');
    });

    it('handles error from getTeamStatus gracefully', async () => {
      const registry = TeamRegistry.getInstance();
      const team1 = { getTeamStatus: vi.fn().mockRejectedValue(new Error('fail')) };
      registry.teams.set('team1', team1);

      await refreshWidget({ theme: mockTheme, setWidget: mockUI.setWidget } as any);
      await Promise.resolve();

      const linesArg = mockUI.setWidget.mock.calls[0][1];
      const fullText = linesArg.join('\n');
      expect(fullText).toContain('Team team1: error fetching status');
    });

    it('catches exceptions in registry access', async () => {
      const origGetAll = TeamRegistry.getInstance().getAll.bind(TeamRegistry.getInstance());
      vi.spyOn(TeamRegistry.getInstance(), 'getAll').mockImplementation(() => { throw new Error('registry error'); });

      // Should not throw; catch block resolves silently
      await refreshWidget({ theme: mockTheme, setWidget: mockUI.setWidget } as any);
      await Promise.resolve(); // flush

      // No setWidget expected in this case because we return early in catch block
      expect(mockUI.setWidget).not.toHaveBeenCalled();

      TeamRegistry.getInstance().getAll = origGetAll;
    });
  });

  describe('startWidget and stopWidget', () => {
    it('startWidget sets interval and calls initial refresh', async () => {
      const ctx = createMockContext();
      const intervalId = 123;
      vi.spyOn(globalThis, 'setInterval').mockReturnValue(intervalId);

      startWidget(ctx);

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 2000);
      await Promise.resolve(); // wait for initial refresh microtask
      expect(mockUI.setWidget).toHaveBeenCalled(); // initial refresh called
    });

    it('stopWidget clears interval and clears widget', () => {
      const state = {
        enabled: true,
        ctx: createMockContext(),
        intervalId: 999
      } as any;
      const clearSpy = vi.spyOn(globalThis, 'clearInterval');

      stopWidget(state);

      expect(clearSpy).toHaveBeenCalledWith(999);
      expect(mockUI.setWidget).toHaveBeenCalledWith('team', undefined);
      expect(state.ctx).toBeNull();
      expect(state.intervalId).toBeNull();
    });
  });

  describe('toggleTeamWidget and getTeamWidgetEnabled', () => {
    it('toggle returns new state and persists', () => {
      const ctx = createMockContext();
      const initialState = ensureState(ctx);
      expect(initialState.enabled).toBe(true);

      const newEnabled = toggleTeamWidget(ctx);
      expect(newEnabled).toBe(false);
      expect(getTeamWidgetEnabled(ctx)).toBe(false);

      const reToggle = toggleTeamWidget(ctx);
      expect(reToggle).toBe(true);
    });
  });

  describe('registerTeamWidget', () => {
    it('registers session_start only initially', () => {
      const api = { on: vi.fn() };
      registerTeamWidget(api);

      expect(api.on).toHaveBeenCalledTimes(1);
      expect(api.on).toHaveBeenCalledWith('session_start', expect.any(Function));
    });

    it('session_start registers session_shutdown and starts widget', async () => {
      const api = { on: vi.fn() };
      registerTeamWidget(api);

      // Get session_start handler
      const [, startHandler] = api.on.mock.calls[0];

      // Invoke session_start
      const mockSessionCtx = createMockContext();
      await startHandler(null as any, mockSessionCtx);

      // Now api.on should have been called again for session_shutdown
      expect(api.on).toHaveBeenCalledTimes(2);
      expect(api.on).toHaveBeenCalledWith('session_shutdown', expect.any(Function));

      // Also verify widget started (initial refresh called)
      await Promise.resolve(); // flush microtasks
      expect(mockUI.setWidget).toHaveBeenCalled();
    });

    it('session_shutdown cleans up state', async () => {
      const api = { on: vi.fn() };
      registerTeamWidget(api);

      const [, startHandler] = api.on.mock.calls[0];
      const mockSessionCtx = createMockContext();
      await startHandler(null as any, mockSessionCtx);

      const [, shutdownHandler] = api.on.mock.calls[1];
      const clearSpy = vi.spyOn(globalThis, 'clearInterval');
      await shutdownHandler();
      expect(clearSpy).toHaveBeenCalled();
      expect(mockUI.setWidget).toHaveBeenCalledWith('team', undefined);
    });
  });
});
