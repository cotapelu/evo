import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
}));

import { existsSync, mkdirSync, appendFileSync } from 'node:fs';

// Import the extension
import contextLogger from '../../extensions/context-logger.ts';

describe('Context Logger Extension', () => {
  let mockApi: any;
  let eventHandler: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // default: directory exists
    (existsSync as any).mockReturnValue(true);
    (mkdirSync as any).mockClear();
    (appendFileSync as any).mockClear();

    mockApi = {
      registerFlag: vi.fn(),
      on: vi.fn((event: string, fn: any) => {
        if (event === 'before_provider_request') {
          eventHandler = fn;
        }
      }),
      getFlag: vi.fn(),
    };

    // Initialize extension
    contextLogger(mockApi);
  });

  it('registers contextLogFile flag with correct metadata', () => {
    expect(mockApi.registerFlag).toHaveBeenCalledWith(
      'contextLogFile',
      expect.objectContaining({
        description: expect.stringContaining('LLM context'),
        type: 'string',
        default: undefined,
      })
    );
  });

  it('registers contextLogAppend flag with correct metadata', () => {
    expect(mockApi.registerFlag).toHaveBeenCalledWith(
      'contextLogAppend',
      expect.objectContaining({
        description: expect.stringContaining('Append'),
        type: 'boolean',
        default: true,
      })
    );
  });

  it('sets up before_provider_request event listener', () => {
    expect(mockApi.on).toHaveBeenCalledWith('before_provider_request', expect.any(Function));
  });

  describe('event handler behavior', () => {
    const samplePayload = {
      model: 'gpt-4',
      context: { messages: [{ role: 'user', content: 'Hello' }] },
      options: { temperature: 0.5 },
    };

    it('logs to default path when contextLogFile is undefined', () => {
      mockApi.getFlag.mockReturnValue(undefined);
      eventHandler({ payload: samplePayload }, {});
      expect(appendFileSync).toHaveBeenCalled();
    });

    it('does not log when contextLogFile is empty string', () => {
      mockApi.getFlag.mockReturnValue('');
      eventHandler({ payload: samplePayload }, {});
      expect(appendFileSync).not.toHaveBeenCalled();
    });

    it('does not log when contextLogFile is "false"', () => {
      mockApi.getFlag.mockReturnValue('false');
      eventHandler({ payload: samplePayload }, {});
      expect(appendFileSync).not.toHaveBeenCalled();
    });

    it('logs to file when contextLogFile is set and directory exists', () => {
      const logPath = '/tmp/context.log';
      mockApi.getFlag.mockReturnValue(logPath);
      (existsSync as any).mockReturnValue(true);
      eventHandler({ payload: samplePayload }, {});
      expect(appendFileSync).toHaveBeenCalledWith(
        logPath,
        expect.stringContaining('"model":"gpt-4"')
      );
    });

    it('creates directory when it does not exist and then logs', () => {
      const logPath = '/tmp/does/not/exist/context.log';
      mockApi.getFlag.mockReturnValue(logPath);
      (existsSync as any).mockReturnValue(false);
      eventHandler({ payload: samplePayload }, {});
      const logDir = '/tmp/does/not/exist';
      expect(mkdirSync).toHaveBeenCalledWith(logDir, { recursive: true });
      expect(appendFileSync).toHaveBeenCalledWith(
        logPath,
        expect.stringContaining('"model":"gpt-4"')
      );
    });

    it('handles appendFileSync error and does not crash', () => {
      const logPath = '/tmp/context.log';
      mockApi.getFlag.mockReturnValue(logPath);
      (existsSync as any).mockReturnValue(true);
      (appendFileSync as any).mockImplementation(() => {
        throw new Error('EACCES');
      });
      // Should not throw; error is caught and printed to console.error
      expect(() => eventHandler({ payload: samplePayload }, {})).not.toThrow();
      // console.error may be called but we don't check
    });

    it('logs JSON line with timestamp, model, context, options', () => {
      const logPath = '/tmp/context.log';
      mockApi.getFlag.mockReturnValue(logPath);
      (existsSync as any).mockReturnValue(true);
      eventHandler({ payload: samplePayload }, {});

      const loggedString = (appendFileSync as any).mock.calls[0][1];
      const parsed = JSON.parse(loggedString.trim().split('\n')[0]); // in case multiple lines
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed.model).toBe('gpt-4');
      expect(parsed.context).toEqual(samplePayload.context);
      expect(parsed.options).toEqual(samplePayload.options);
    });
  });
});
