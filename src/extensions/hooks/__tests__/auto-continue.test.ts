import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';

// Mock fs and path before importing the module
const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockJoin = jest.fn();

jest.unstable_mockModule('node:fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

jest.unstable_mockModule('node:path', () => ({
  join: mockJoin,
  parse: () => ({ root: '/' }),
  dirname: jest.fn((p: string) => p.replace(/\/[^/]+$/, '')),
}));

let autoContinueModule: any;

beforeAll(async () => {
  // Set up default mocks
  mockJoin.mockImplementation((...parts) => parts.join('/'));

  // Import the module
  autoContinueModule = await import('../auto-continue.js');
});

describe('Auto-Continue Extension', () => {
  let mockPi: any;
  let mockCtx: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReset();
    mockJoin.mockReset();

    mockPi = {
      registerCommand: jest.fn(),
      on: jest.fn(),
      sendMessage: jest.fn(),
    };

    mockCtx = {
      hasUI: true,
      ui: { notify: jest.fn() },
      isIdle: jest.fn().mockReturnValue(false),
    };
  });

  describe('initialization', () => {
    it('should register /gnpi command', () => {
      autoContinueModule.default(mockPi);

      expect(mockPi.registerCommand).toHaveBeenCalledWith(
        'gnpi',
        expect.objectContaining({
          description: expect.stringMatching(/Toggle auto-continue/),
          handler: expect.any(Function),
        })
      );
    });

    it('should register agent_end event listener', () => {
      autoContinueModule.default(mockPi);

      expect(mockPi.on).toHaveBeenCalledWith('agent_end', expect.any(Function));
    });

    it('should register session_shutdown cleanup handler', () => {
      autoContinueModule.default(mockPi);

      expect(mockPi.on).toHaveBeenCalledWith('session_shutdown', expect.any(Function));
    });
  });

  describe('command handler', () => {
    let handler: (args: string, ctx: any) => Promise<void>;

    beforeEach(() => {
      autoContinueModule.default(mockPi);
      handler = mockPi.registerCommand.mock.calls[0][1].handler;
    });

    it('should disable and notify when called with "off"', async () => {
      await handler('off', mockCtx);

      expect(mockCtx.ui.notify).toHaveBeenCalledWith('Auto-continue disabled', 'info');
    });

    it('should enable and notify when called with "on"', async () => {
      await handler('on', mockCtx);

      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        expect.stringContaining('Auto-continue enabled'),
        'info'
      );
    });

    it('should set timeout and notify when given a number', async () => {
      await handler('60', mockCtx);

      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        'Auto-continue timeout set to 60 seconds',
        'info'
      );
    });

    it('should toggle state when called with empty string', async () => {
      // First toggle: off -> on
      await handler('', mockCtx);
      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        expect.stringContaining('Auto-continue enabled'),
        'info'
      );

      mockCtx.ui.notify.mockClear();

      // Second toggle: on -> off
      await handler('', mockCtx);
      expect(mockCtx.ui.notify).toHaveBeenCalledWith('Auto-continue disabled', 'info');
    });

    it('should handle "0" as off', async () => {
      await handler('0', mockCtx);
      expect(mockCtx.ui.notify).toHaveBeenCalledWith('Auto-continue disabled', 'info');
    });

    it('should handle "1" as on', async () => {
      await handler('1', mockCtx);
      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        expect.stringContaining('Auto-continue enabled'),
        'info'
      );
    });

    it('should trim whitespace from arguments', async () => {
      await handler('  on  ', mockCtx);
      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        expect.stringContaining('Auto-continue enabled'),
        'info'
      );
    });
  });


});
