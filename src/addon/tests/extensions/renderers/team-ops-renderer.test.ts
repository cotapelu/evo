import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTeamOpsRenderer } from '../../../extensions/renderers/team-ops-renderer.ts';

// Mock @earendil-works/pi-tui Text
vi.mock('@earendil-works/pi-tui', () => ({
  Text: class Text {
    text: string;
    constructor(text: string, _x: number, _y: number) {
      this.text = text;
    }
  },
}));

describe('Team Ops Renderer', () => {
  let mockApi: any;
  let capturedRenderer: any;

  beforeEach(() => {
    mockApi = { registerMessageRenderer: vi.fn() };
    capturedRenderer = null;
    (mockApi.registerMessageRenderer as any).mockImplementation((type: string, fn: any) => {
      if (type === 'team_ops_result') capturedRenderer = fn;
    });
    registerTeamOpsRenderer(mockApi);
  });

  function mockTheme() {
    return {
      fg: (c: string, v: string) => v,
      bold: (v: string) => v,
    };
  }

  it('renders fallback when no details', () => {
    const msg = { details: undefined, content: [] };
    const result = capturedRenderer(msg, {}, mockTheme());
    expect(result.text).toBe('👥 Team operation');
  });

  it('shows content text if present and not error', () => {
    const msg = {
      details: { action: 'get_team_status' },
      content: [{ text: 'Team status retrieved' }]
    };
    const result = capturedRenderer(msg, {}, mockTheme());
    expect(result.text).toContain('Team status retrieved');
  });

  it('hides content if it contains ❌', () => {
    const msg = {
      details: { action: 'get_team_status' },
      content: [{ text: '❌ Something failed badly' }]
    };
    const result = capturedRenderer(msg, {}, mockTheme());
    expect(result.text).not.toContain('❌ Something failed badly');
  });

  it('renders error from details or msg.isError', () => {
    const msg = {
      details: { action: 'claim_task', error: 'No tasks available' },
      isError: true,
      content: []
    };
    const result = capturedRenderer(msg, {}, mockTheme());
    expect(result.text).toContain('❌ No tasks available');
  });

  describe('action renderers', () => {
    it('get_team_status renders status block', () => {
      const details = {
        action: 'get_team_status',
        teamId: 'team-1',
        totalAgents: 5,
        activeAgents: 3,
        pendingTasks: 2,
        completedTasks: 10,
        agents: [
          { id: 'agent-1', status: 'working', currentTask: 'task-abc' },
          { id: 'agent-2', status: 'idle' }
        ]
      };
      const msg = { details, content: [] };
      const result = capturedRenderer(msg, {}, mockTheme());
      const text = result.text;
      expect(text).toContain('Team: team-1');
      expect(text).toContain('Agents: 3/5 active');
      expect(text).toContain('Tasks: 2 pending, 10 completed');
      expect(text).toContain('agent-1');
      expect(text).toContain('working');
      expect(text).toContain('task-abc');
    });

    it('get_messages renders list with truncation', () => {
      const details = {
        action: 'get_messages',
        messages: Array.from({ length: 12 }, (_, i) => ({
          from: `user${i+1}`,
          channel: 'team.chat',
          content: `Message ${i+1} with some text`
        }))
      };
      const msg = { details, content: [] };
      const result = capturedRenderer(msg, {}, mockTheme());
      expect(result.text).toContain('Messages (12):');
      expect(result.text).toContain('user1');
      expect(result.text).toContain('...and 2 more.');
    });

    it('workspace_read renders key and truncated value', () => {
      const details = { action: 'workspace_read', key: 'secret', value: 'x'.repeat(300) };
      const msg = { details, content: [] };
      const result = capturedRenderer(msg, {}, mockTheme());
      expect(result.text).toContain('Workspace key: secret');
      expect(result.text).toContain('x'.repeat(200) + '...');
    });

    it('workspace_read shows dim when no value', () => {
      const details = { action: 'workspace_read', key: 'k' };
      const msg = { details, content: [] };
      const result = capturedRenderer(msg, {}, mockTheme());
      expect(result.text).toContain('No value set');
    });

    it('workspace_write success', () => {
      const details = { action: 'workspace_write', key: 'k' };
      const msg = { details, content: [] };
      const result = capturedRenderer(msg, {}, mockTheme());
      expect(result.text).toContain('✓ Wrote to workspace');
      expect(result.text).toContain('k');
    });

    it('send_message success', () => {
      const details = { action: 'send_message', channel: 'alerts' };
      const msg = { details, content: [] };
      const result = capturedRenderer(msg, {}, mockTheme());
      expect(result.text).toContain('✓ Message sent');
      expect(result.text).toContain('alerts');
    });

    it('claim_task with taskIndex', () => {
      const details = { action: 'claim_task', taskIndex: 5 };
      const msg = { details, content: [] };
      const result = capturedRenderer(msg, {}, mockTheme());
      expect(result.text).toContain('✓ Claimed task');
      expect(result.text).toContain('#5');
    });

    it('claim_task with no tasks', () => {
      const details = { action: 'claim_task', taskIndex: undefined };
      const msg = { details, content: [] };
      const result = capturedRenderer(msg, {}, mockTheme());
      expect(result.text).toContain('No tasks available');
    });

    it('complete_task', () => {
      const details = { action: 'complete_task', taskIndex: 3 };
      const msg = { details, content: [] };
      const result = capturedRenderer(msg, {}, mockTheme());
      expect(result.text).toContain('✓ Completed task');
      expect(result.text).toContain('#3');
    });

    it('release_task', () => {
      const details = { action: 'release_task', taskIndex: 7 };
      const msg = { details, content: [] };
      const result = capturedRenderer(msg, {}, mockTheme());
      expect(result.text).toContain('↩ Released task');
      expect(result.text).toContain('#7');
    });

    it('update_status', () => {
      const details = { action: 'update_status', status: 'offline' };
      const msg = { details, content: [] };
      const result = capturedRenderer(msg, {}, mockTheme());
      expect(result.text).toContain('● Status updated');
      expect(result.text).toContain('offline');
    });

    it('unknown action shows warning', () => {
      const details = { action: 'unknown_action' };
      const msg = { details, content: [] };
      const result = capturedRenderer(msg, {}, mockTheme());
      expect(result.text).toContain('Unknown action: unknown_action');
    });
  });
});
