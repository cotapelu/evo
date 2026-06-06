import { jest } from '@jest/globals';
import autoCompact85 from '../auto-compact-85.js';

describe('auto-compact-85 hook', () => {
  let api: any;

  beforeEach(() => {
    api = { on: jest.fn() };
  });

  it('should register agent_end listener on extension API', () => {
    autoCompact85(api);
    expect(api.on).toHaveBeenCalledWith('agent_end', expect.any(Function));
  });

  it('should compact when context usage exceeds threshold', async () => {
    const mockCompact = jest.fn().mockResolvedValue(undefined);
    const mockCtx = {
      getContextUsage: () => ({ percent: 90 }),
      compact: mockCompact
    };
    const handler = jest.fn(); // will be the registered callback

    const mockPi = {
      on: (event: string, cb: Function) => {
        if (event === 'agent_end') handler.mockImplementation(cb);
      }
    };

    autoCompact85(mockPi);

    // Simulate agent_end event
    await handler({}, mockCtx);

    expect(mockCompact).toHaveBeenCalledTimes(1);
  });

  it('should not compact when usage below threshold', async () => {
    const mockCompact = jest.fn().mockResolvedValue(undefined);
    const mockCtx = {
      getContextUsage: () => ({ percent: 80 }),
      compact: mockCompact
    };
    const handler = jest.fn();

    const mockPi = {
      on: (event: string, cb: Function) => {
        if (event === 'agent_end') handler.mockImplementation(cb);
      }
    };

    autoCompact85(mockPi);
    await handler({}, mockCtx);

    expect(mockCompact).not.toHaveBeenCalled();
  });

  it('should not compact when usage undefined', async () => {
    const mockCompact = jest.fn().mockResolvedValue(undefined);
    const mockCtx = {
      getContextUsage: () => undefined,
      compact: mockCompact
    };
    const handler = jest.fn();

    const mockPi = {
      on: (event: string, cb: Function) => {
        if (event === 'agent_end') handler.mockImplementation(cb);
      }
    };

    autoCompact85(mockPi);
    await handler({}, mockCtx);

    expect(mockCompact).not.toHaveBeenCalled();
  });
});
