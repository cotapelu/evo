import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTeamCommand } from '../../extensions/commands/team-command.js';

// Mock team widget module
vi.mock('../../extensions/team/team-widget.js', () => ({
  toggleTeamWidget: vi.fn(),
  getTeamWidgetEnabled: vi.fn(),
}));

import { toggleTeamWidget, getTeamWidgetEnabled } from '../../extensions/team/team-widget.js';

function mockCtx(overrides: any = {}) {
  return {
    ui: {
      notify: vi.fn(),
    },
    ...overrides,
  };
}

describe('Team Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers command', () => {
    const api = { registerCommand: vi.fn() };
    registerTeamCommand(api);
    expect(api.registerCommand).toHaveBeenCalledWith('team', expect.any(Object));
  });

  it('toggles team widget and notifies', async () => {
    const api = { registerCommand: vi.fn() };
    registerTeamCommand(api);
    const handler = api.registerCommand.mock.calls[0][1].handler;
    (toggleTeamWidget as any).mockReturnValue(true); // after toggle becomes shown
    const ctx = mockCtx({});
    await handler('', ctx);
    expect(getTeamWidgetEnabled).toHaveBeenCalledWith(ctx);
    expect(toggleTeamWidget).toHaveBeenCalledWith(ctx);
    expect(ctx.ui.notify).toHaveBeenCalledWith('Team widget shown', 'info');
  });

  it('handles toggle off', async () => {
    const api = { registerCommand: vi.fn() };
    registerTeamCommand(api);
    const handler = api.registerCommand.mock.calls[0][1].handler;
    (toggleTeamWidget as any).mockReturnValue(false);
    const ctx = mockCtx({});
    await handler('', ctx);
    expect(toggleTeamWidget).toHaveBeenCalledWith(ctx);
    expect(ctx.ui.notify).toHaveBeenCalledWith('Team widget hidden', 'info');
  });
});
