import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be defined before any imports of the modules they replace

// Mock node:worker_threads
let mockParentPort: any;
let mockWorkerData: any;
vi.mock('node:worker_threads', () => ({
  get parentPort() { return mockParentPort; },
  get workerData() { return mockWorkerData; },
}));

// Mock child-tools
vi.mock('../../extensions/multi-agent-tool/child-tools.js', () => ({
  setCurrentChildId: vi.fn()
}));
import { setCurrentChildId } from '../../extensions/multi-agent-tool/child-tools.js';

// Mock messageBus with sendToParent and sendToChild
vi.mock('../../extensions/multi-agent-tool/message-bus.js', () => ({
  messageBus: {
    sendToParent: vi.fn(),
    sendToChild: vi.fn(),
    onIncomingMessage: vi.fn(() => () => {})
  }
}));
import { messageBus } from '../../extensions/multi-agent-tool/message-bus.js';

// Mock createAgentSessionFromServices
vi.mock('@earendil-works/pi-coding-agent', () => ({
  createAgentSessionFromServices: vi.fn()
}));
import { createAgentSessionFromServices } from '@earendil-works/pi-coding-agent';

describe('Child Worker', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Reset mock variables
    mockParentPort = { on: vi.fn(), postMessage: vi.fn() };
    mockWorkerData = {
      config: { id: 'child-1' },
      services: {
        modelRuntime: { getModel: vi.fn().mockReturnValue({}) }
      },
      sessionManager: {},
      model: 'anthropic/claude',
      thinkingLevel: 'medium',
      mission: 'test mission',
      context: { key: 'value' },
      tools: ['tool1']
    };

    // Mock session.prompt resolution
    const mockSession = { prompt: vi.fn().mockResolvedValue('output') };
    (createAgentSessionFromServices as any).mockResolvedValue({ session: mockSession });

    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => {});

    // Dynamically import child-worker after all mocks are set
    await import('../../extensions/multi-agent-tool/worker/child-worker.js');
  });

  it('calls setCurrentChildId with child config id', () => {
    expect(setCurrentChildId).toHaveBeenCalledWith('child-1');
  });

  it('sends ready message after session creation', async () => {
    await Promise.resolve(); // wait for microtasks
    expect(mockParentPort.postMessage).toHaveBeenCalledWith({ type: 'ready', childId: 'child-1' });
  });

  it('handles task message and posts result', async () => {
    const taskHandler = mockParentPort.on.mock.calls.find((c: any) => c[0] === 'message')?.[1];
    expect(taskHandler).toBeDefined();

    await taskHandler({ type: 'task', payload: { mission: 'm', context: {}, tools: [] } });
    await Promise.resolve();

    expect(mockParentPort.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'result' }));
  });

  it('handles cancel message and exits', async () => {
    const taskHandler = mockParentPort.on.mock.calls.find((c: any) => c[0] === 'message')?.[1];
    await taskHandler({ type: 'cancel' });
    expect(mockParentPort.postMessage).toHaveBeenCalledWith({
      type: 'error',
      payload: { message: 'Cancelled', recoverable: false }
    });
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('forwards input message to messageBus.sendToChild', async () => {
    const taskHandler = mockParentPort.on.mock.calls.find((c: any) => c[0] === 'message')?.[1];
    await taskHandler({ type: 'input', payload: { some: 'data' } });
    expect(messageBus.sendToChild).toHaveBeenCalledWith('child-1', { type: 'input', payload: { some: 'data' } });
  });
});
