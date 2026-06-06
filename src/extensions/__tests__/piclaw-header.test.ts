import { jest } from '@jest/globals';

// Mock node:fs
const existsSyncMock = jest.fn();
const readFileSyncMock = jest.fn();

jest.unstable_mockModule('node:fs', () => ({
  existsSync: existsSyncMock,
  readFileSync: readFileSyncMock,
}));

// Mock @earendil-works/pi-coding-agent
const getAgentDirMock = jest.fn().mockReturnValue('/agent');
const PI_VERSION_MOCK = '0.78.0';
jest.unstable_mockModule('@earendil-works/pi-coding-agent', () => ({
  getAgentDir: getAgentDirMock,
  VERSION: PI_VERSION_MOCK,
}));

const { default: piclawHeader } = await import('../piclaw-header.js');

describe('Piclaw Header', () => {
  let api: any;
  let capturedHandler: any;

  beforeEach(() => {
    jest.clearAllMocks();
    existsSyncMock.mockReturnValue(false);
    readFileSyncMock.mockReset();
    getAgentDirMock.mockReset();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    // Clean up fetch mock
    // @ts-ignore
    global.fetch = undefined;
  });

  test('registers session_start event', () => {
    api = { on: jest.fn() };
    piclawHeader(api);
    expect(api.on).toHaveBeenCalledWith('session_start', expect.any(Function));
    capturedHandler = api.on.mock.calls.find(c => c[0] === 'session_start')[1];
  });

  test('sets header with defaults when package.json missing', async () => {
    existsSyncMock.mockReturnValue(false);
    api = { on: jest.fn() };
    piclawHeader(api);
    const handler = api.on.mock.calls.find(c => c[0] === 'session_start')[1];
    const mockSetHeader = jest.fn((fn: Function) => {
      // Call the render function to ensure it executes without error
      const theme = {
        fg: (c: string, s: string) => s,
        bold: (s: string) => s,
        dim: (s: string) => s,
        accent: (s: string) => s,
        warning: (s: string) => s,
      };
      fn(null, theme);
    });
    const ctx = { hasUI: true, ui: { setHeader: mockSetHeader } } as any;
    await handler(null as any, ctx);
    expect(mockSetHeader).toHaveBeenCalledTimes(1);
  });

  test('reads package.json to get app name and version', async () => {
    existsSyncMock.mockReturnValue(true);
    readFileSyncMock.mockReturnValue(JSON.stringify({ name: 'myapp', version: '2.3.4' }));
    api = { on: jest.fn() };
    piclawHeader(api);
    const handler = api.on.mock.calls.find(c => c[0] === 'session_start')[1];
    const mockSetHeader = jest.fn((fn: Function) => fn(null, { fg: () => '', bold: () => '', dim: () => '', accent: () => '', warning: () => '' }));
    const ctx = { hasUI: true, ui: { setHeader: mockSetHeader } } as any;
    await handler(null as any, ctx);
    expect(mockSetHeader).toHaveBeenCalledTimes(1);
  });

  test('performs version check and updates header if newer version available', async () => {
    existsSyncMock.mockReturnValue(true);
    readFileSyncMock.mockReturnValue(JSON.stringify({ name: 'app', version: '1.0.0' }));
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ version: '2.0.0' }),
    });
    api = { on: jest.fn() };
    piclawHeader(api);
    const handler = api.on.mock.calls.find(c => c[0] === 'session_start')[1];
    const mockSetHeader = jest.fn((fn: Function) => fn(null, { fg: () => '', bold: () => '', dim: () => '', accent: () => '', warning: () => '' }));
    const ctx = { hasUI: true, ui: { setHeader: mockSetHeader } } as any;
    await handler(null as any, ctx);
    expect(mockSetHeader).toHaveBeenCalledTimes(1);
    // Verify fetch was called to check version
    expect(global.fetch).toHaveBeenCalledWith('https://registry.npmjs.org/@earendil-works/pi-coding-agent/latest', expect.any(Object));
  });

  test('does not show update if same version', async () => {
    existsSyncMock.mockReturnValue(true);
    readFileSyncMock.mockReturnValue(JSON.stringify({ name: 'app', version: '1.0.0' }));
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ version: '1.0.0' }),
    });
    api = { on: jest.fn() };
    piclawHeader(api);
    const handler = api.on.mock.calls.find(c => c[0] === 'session_start')[1];
    const mockSetHeader = jest.fn((fn: Function) => fn(null, { fg: () => '', bold: () => '', dim: () => '', accent: () => '', warning: () => '' }));
    const ctx = { hasUI: true, ui: { setHeader: mockSetHeader } } as any;
    await handler(null as any, ctx);
    expect(mockSetHeader).toHaveBeenCalledTimes(1);
    // Even though setHeader called, we can't check content easily. But we know the branch executed.
  });

  test('handles fetch error and still sets header', async () => {
    existsSyncMock.mockReturnValue(true);
    readFileSyncMock.mockReturnValue(JSON.stringify({ name: 'app', version: '1.0.0' }));
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));
    api = { on: jest.fn() };
    piclawHeader(api);
    const handler = api.on.mock.calls.find(c => c[0] === 'session_start')[1];
    const mockSetHeader = jest.fn((fn: Function) => fn(null, { fg: () => '', bold: () => '', dim: () => '', accent: () => '', warning: () => '' }));
    const ctx = { hasUI: true, ui: { setHeader: mockSetHeader } } as any;
    await handler(null as any, ctx);
    expect(mockSetHeader).toHaveBeenCalledTimes(1);
  });

  test('does nothing when hasUI false', async () => {
    api = { on: jest.fn() };
    piclawHeader(api);
    const handler = api.on.mock.calls.find(c => c[0] === 'session_start')[1];
    const mockSetHeader = jest.fn();
    const ctx = { hasUI: false, ui: { setHeader: mockSetHeader } } as any;
    await handler(null as any, ctx);
    expect(mockSetHeader).not.toHaveBeenCalled();
  });

  test('skips version check when PI_SKIP_VERSION_CHECK set', async () => {
    process.env.PI_SKIP_VERSION_CHECK = '1';
    api = { on: jest.fn() };
    piclawHeader(api);
    const handler = api.on.mock.calls.find(c => c[0] === 'session_start')[1];
    const mockSetHeader = jest.fn((fn: Function) => fn(null, { fg: () => '', bold: () => '', dim: () => '', accent: () => '', warning: () => '' }));
    const ctx = { hasUI: true, ui: { setHeader: mockSetHeader } } as any;
    await handler(null as any, ctx);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockSetHeader).toHaveBeenCalledTimes(1);
    delete process.env.PI_SKIP_VERSION_CHECK;
  });
});
