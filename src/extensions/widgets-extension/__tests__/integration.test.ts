#!/usr/bin/env node
/**
 * Widgets Extension – Integration Tests
 */

import { jest } from '@jest/globals';
import registerWidgetsExtension from '../index.js';
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function createMockApi(): any {
  const ui = {
    setWidget: jest.fn(),
    select: jest.fn(() => Promise.resolve('A')),
    editor: jest.fn(() => Promise.resolve('text')),
    notify: jest.fn(),
  };
  const api: any = {
    on: jest.fn(),
    registerCommand: jest.fn(),
    ui,
  };
  return api;
}

describe('Widgets Extension', () => {
  let api: any;

  beforeEach(() => {
    api = createMockApi();
  });

  it('registers without throwing', () => {
    expect(() => registerWidgetsExtension(api)).not.toThrow();
  });

  it('sets up event listeners for session_start and turn_end', () => {
    registerWidgetsExtension(api);
    expect(api.on).toHaveBeenCalledWith('session_start', expect.any(Function));
    expect(api.on).toHaveBeenCalledWith('turn_end', expect.any(Function));
  });

  it('registers overlay-demo command', () => {
    registerWidgetsExtension(api);
    expect(api.registerCommand).toHaveBeenCalledWith('overlay-demo', expect.objectContaining({
      description: expect.any(String),
      handler: expect.any(Function),
    }));
  });

  it('overlay-demo command uses UI methods', async () => {
    registerWidgetsExtension(api);
    // Find the registered command handler
    const call = api.registerCommand.mock.calls.find((c: any[]) => c[0] === 'overlay-demo');
    expect(call).toBeDefined();
    const { handler } = call[1];
    await handler('', api); // args empty, context = api
    expect(api.ui.select).toHaveBeenCalled();
    expect(api.ui.editor).toHaveBeenCalled();
    expect(api.ui.notify).toHaveBeenCalled();
  });

  it('turn_end handler calls setWidget', () => {
    registerWidgetsExtension(api);
    // Get turn_end handler
    const turnEndCall = api.on.mock.calls.find((c: any[]) => c[0] === 'turn_end');
    expect(turnEndCall).toBeDefined();
    const handler = turnEndCall[1];
    handler('', api);
    expect(api.ui.setWidget).toHaveBeenCalledWith('turn-stats', expect.any(Function));
  });
});
