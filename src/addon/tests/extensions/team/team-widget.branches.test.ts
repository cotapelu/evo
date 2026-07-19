import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock TeamRegistry to avoid heavy dependencies
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

import {
  startWidget,
  stopWidget,
  toggleTeamWidget,
  getTeamWidgetEnabled,
  ensureState,
  registerTeamWidget,
  TEAM_WIDGET_STATE,
  buildTeamLines,
  refreshWidget
} from '../../../extensions/team/team-widget.ts';

import { TeamRegistry } from '../../../extensions/team/team-manager.js';

const mockUI = {
  setWidget: vi.fn(),
  theme: { fg: (c: string, v: string) => v } as any,
};

const createMockContext = () => {
  const ctx: any = { ui: mockUI, on: vi.fn() };
  return ctx;
};

describe('Team Widget branch coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TeamRegistry.getInstance().teams.clear();
    mockUI.setWidget.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('startWidget early returns if already started', () => {
    const ctx = createMockContext();
    // First start
    startWidget(ctx);
    expect(mockUI.setWidget).toHaveBeenCalledTimes(1);
    // Second start should return early without calling setWidget again
    startWidget(ctx);
    expect(mockUI.setWidget).toHaveBeenCalledTimes(1); // unchanged
  });

  it('stopWidget handles state with no intervalId', () => {
    const ctx = createMockContext();
    const state = ensureState(ctx);
    state.intervalId = null;
    state.ctx = ctx;
    // Should not throw and should still clear UI (setWidget called) but does not try to clearInterval
    stopWidget(state);
    expect(mockUI.setWidget).toHaveBeenCalledWith('team', undefined);
    expect(state.ctx).toBeNull();
  });

  it('interval callback does nothing when disabled', async () => {
    const ctx = createMockContext();
    // Start the widget (enabled true by default) - this sets an interval
    startWidget(ctx);
    // Wait for the initial refreshWidget call to be queued and executed
    await Promise.resolve();
    // Clear the mock to forget the initial call
    mockUI.setWidget.mockClear();
    // Disable the widget without stopping the interval
    const state = ensureState(ctx);
    state.enabled = false;
    // Advance virtual time to trigger the interval once
    await vi.advanceTimersByTimeAsync(2000);
    // No setWidget should have been called while disabled
    expect(mockUI.setWidget).not.toHaveBeenCalled();
  });

  it('interval callback calls refreshWidget when enabled', async () => {
    const ctx = createMockContext();
    // Start the widget (enabled by default)
    startWidget(ctx);
    // Wait for the initial refreshWidget call to complete
    await Promise.resolve();
    // Clear the mock to only see interval-triggered calls
    mockUI.setWidget.mockClear();
    // Advance virtual time to trigger the interval once (2000ms)
    await vi.advanceTimersByTimeAsync(2000);
    // The setWidget should have been called because enabled is true
    expect(mockUI.setWidget).toHaveBeenCalled();
  });
});
