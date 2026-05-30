import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock modules before import
await jest.unstable_mockModule('@earendil-works/pi-tui', () => ({
  TUI: jest.fn().mockImplementation(() => ({
    addChild: jest.fn(),
    setFocus: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    keyHandler: jest.fn(),
    requestRender: jest.fn(),
    addInputListener: jest.fn().mockReturnValue(() => {}),
    showOverlay: jest.fn().mockReturnValue({ hide: jest.fn() }),
    terminal: { setTitle: jest.fn() },
    setClearOnShrink: jest.fn(),
  })),
  ProcessTerminal: jest.fn(),
  Container: jest.fn().mockImplementation(() => ({
    addChild: jest.fn(),
    clear: jest.fn(),
  })),
  Text: (jest.fn() as any).mockImplementation((text?: string, px?: number, py?: number) => ({ text, px, py })),
  Spacer: jest.fn(),
  ExpandableText: jest.fn(),
  setKeybindings: jest.fn(),
  CombinedAutocompleteProvider: jest.fn(),
  fuzzyFilter: (items: any[], prefix: string, fn: any) => items,
  Markdown: jest.fn(),
  matchesKey: jest.fn(),
}));

await jest.unstable_mockModule('@earendil-works/pi-coding-agent', () => ({
  AgentSessionRuntime: jest.fn(),
  CustomEditor: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    off: jest.fn(),
    setText: jest.fn(),
    getText: () => '',
  })),
  FooterComponent: jest.fn().mockImplementation(() => ({
    setSession: jest.fn(),
    setAutoCompactEnabled: jest.fn(),
    dispose: jest.fn(),
  })),
  InteractiveModeOptions: {},
  parseSkillBlock: jest.fn(),
  AssistantMessageComponent: jest.fn(),
  UserMessageComponent: jest.fn(),
  ToolExecutionComponent: jest.fn(),
  DynamicBorder: jest.fn(),
  getMarkdownTheme: jest.fn().mockReturnValue({}),
  ThinkingSelectorComponent: jest.fn(),
  ModelSelectorComponent: jest.fn(),
}));

await jest.unstable_mockModule('child_process', () => ({
  spawnSync: jest.fn(),
}));

// Now import the module
const { InteractiveMode } = await import('../interactive-provider.ts');

// Mock process
const mockExit = jest.fn();
const mockOn = jest.fn();
const mockOff = jest.fn();
beforeAll(() => {
  jest.spyOn(process, 'exit').mockImplementation(mockExit);
  (process as any).on = mockOn;
  (process as any).off = mockOff;
});

afterEach(() => {
  mockExit.mockClear();
  mockOn.mockClear();
  mockOff.mockClear();
});

// Helper to create mock session - same object reference
function createSession(overrides = {}) {
  const sess: any = {
    state: { messages: [] },
    settingsManager: {
      getShowHardwareCursor: () => false,
      getClearOnShrink: () => false,
      getEditorPaddingX: () => 2,
      getAutocompleteMaxVisible: () => 10,
      getTheme: () => 'default',
      getQuietStartup: () => false,
      getLastChangelogVersion: () => '',
      setLastChangelogVersion: jest.fn(),
      getHideThinkingBlock: () => false,
    },
    sessionManager: { getCwd: () => '/tmp' },
    modelRegistry: { getAvailable: () => [] },
    resourceLoader: {
      getSkills: jest.fn(() => ({ skills: [] })),
      getPrompts: jest.fn(() => ({ prompts: [] })),
      getExtensions: jest.fn(() => ({ extensions: [] })),
      getThemes: jest.fn(() => ({ themes: [] })),
      getAgentsFiles: jest.fn(() => ({ agentsFiles: [] })),
    },
    prompt: jest.fn(),
    subscribe: jest.fn((cb: any) => {
      sess._cb = cb;
      return () => { sess._cb = undefined; };
    }),
    agent: { waitForIdle: jest.fn(), interrupt: jest.fn() },
    autoCompactionEnabled: false,
    compact: jest.fn().mockResolvedValue(undefined),
    cycleModel: jest.fn().mockReturnValue({ model: { id: 'gpt-4' } }),
  };
  return Object.assign(sess, overrides);
}

describe('InteractiveMode', () => {
  let runtime: any;
  let session: any;

  beforeEach(() => {
    jest.clearAllMocks();
    session = createSession();
    runtime = { session };
  });

  describe('constructor', () => {
    it('should instantiate', () => {
      const mode = new (InteractiveMode as any)(runtime);
      expect(mode).toBeDefined();
      expect(mode.shutdownRequested).toBe(false);
      expect(mode.toolOutputExpanded).toBe(false);
      expect(mode.hideThinkingBlock).toBe(false);
    });

    it('creates keybindings and components', () => {
      const mode = new (InteractiveMode as any)(runtime);
      expect(mode.keybindings).toBeDefined();
      expect(mode.defaultEditor).toBeDefined();
      expect(mode.footer).toBeDefined();
      expect(mode.footerDataProvider).toBeDefined();
    });
  });

  describe('init', () => {
    it('initializes TUI and containers', async () => {
      const mode = new (InteractiveMode as any)(runtime);
      await (mode as any).init();
      expect(mode.isInitialized).toBe(true);
    });

    it('registers signal handlers', async () => {
      const mode = new (InteractiveMode as any)(runtime);
      await (mode as any).init();
      expect(mockOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      await mode.shutdown();
    });
  });

  describe('handleSlashCommand', () => {
    let mode: any;

    beforeEach(async () => {
      mode = new (InteractiveMode as any)(runtime);
      await (mode as any).init();
    });

    it('/clear clears chat', async () => {
      const clearSpy = jest.spyOn(mode.chatContainer, 'clear');
      await (mode as any).handleSlashCommand('/clear');
      expect(clearSpy).toHaveBeenCalled();
    });

    it('/exit calls shutdown', async () => {
      const shutdownSpy = jest.spyOn(mode, 'shutdown');
      await (mode as any).handleSlashCommand('/exit');
      expect(shutdownSpy).toHaveBeenCalled();
    });

    it('/quit calls shutdown', async () => {
      const shutdownSpy = jest.spyOn(mode, 'shutdown');
      await (mode as any).handleSlashCommand('/quit');
      expect(shutdownSpy).toHaveBeenCalled();
    });

    it('/compact calls session.compact', async () => {
      const compactSpy = jest.spyOn(session, 'compact');
      await (mode as any).handleSlashCommand('/compact');
      expect(compactSpy).toHaveBeenCalled();
    });

    it('/model cycles when no arg', async () => {
      const cycleSpy = jest.spyOn(session, 'cycleModel');
      await (mode as any).handleSlashCommand('/model');
      expect(cycleSpy).toHaveBeenCalled();
    });

    it('/model <spec> selects model', async () => {
      const model = { id: 'claude-3', provider: 'anthropic' };
      session.modelRegistry = { getAvailable: () => [model] };
      await (mode as any).handleSlashCommand('/model claude-3');
      expect(session.model).toEqual(model);
    });

    it('unknown command logs error', async () => {
      const log = jest.spyOn(console, 'log');
      await (mode as any).handleSlashCommand('/unknown');
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));
    });
  });

  describe('handleBash', () => {
    let mode: any;

    beforeEach(async () => {
      mode = new (InteractiveMode as any)(runtime);
      await (mode as any).init();
      mode.defaultEditor.getText = () => 'echo hi';
      mode.defaultEditor.setText = jest.fn();
      const child = await import('child_process') as any;
      child.spawnSync.mockReturnValue({ status: 0, stdout: 'hi', stderr: '' });
    });

    it('spawns shell command', async () => {
      const { spawnSync } = await import('child_process') as any;
      mode.handleBash(false);
      expect(spawnSync).toHaveBeenCalledWith('echo hi', expect.objectContaining({ shell: true }));
    });

    it('adds output to chat', async () => {
      mode.handleBash(false);
      expect(mode.chatContainer.addChild).toHaveBeenCalled();
    });

    it('clears editor after bash', async () => {
      mode.handleBash(false);
      expect(mode.defaultEditor.setText).toHaveBeenCalledWith('');
    });

    it('handles error output', async () => {
      const { spawnSync } = await import('child_process') as any;
      spawnSync.mockReturnValue({ status: 1, stdout: '', stderr: 'err' });
      mode.handleBash(false);
      expect(mode.chatContainer.addChild).toHaveBeenCalled();
    });

    it('skips empty command', async () => {
      mode.defaultEditor.getText = () => '   ';
      mode.handleBash(false);
      const { spawnSync } = await import('child_process') as any;
      expect(spawnSync).not.toHaveBeenCalled();
    });
  });

  describe('subscribeToAgent', () => {
    it('subscribes on init', async () => {
      const mode = new (InteractiveMode as any)(runtime);
      await (mode as any).init();
      expect(session.subscribe).toHaveBeenCalled();
    });

    it('renders assistant message on message_end', async () => {
      const mode = new (InteractiveMode as any)(runtime);
      mode.ui = { requestRender: jest.fn() };
      await (mode as any).init();
      const cb = session._cb;
      cb({ type: 'message_end', message: { role: 'assistant', content: [] } } as any);
      expect(mode.chatContainer.addChild).toHaveBeenCalled();
      expect(mode.ui.requestRender).toHaveBeenCalled();
    });

    it('renders tool on tool_call', async () => {
      const mode = new (InteractiveMode as any)(runtime);
      mode.ui = { requestRender: jest.fn() };
      await (mode as any).init();
      const cb = session._cb;
      cb({ type: 'tool_call', tool: {} } as any);
      expect(mode.chatContainer.addChild).toHaveBeenCalled();
      expect(mode.ui.requestRender).toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('sets shutdownRequested flag', async () => {
      const mode = new (InteractiveMode as any)(runtime);
      await mode.shutdown();
      expect(mode.shutdownRequested).toBe(true);
    });

    it('stops TUI', async () => {
      const mode = new (InteractiveMode as any)(runtime);
      mode.ui = { stop: jest.fn() } as any;
      await mode.shutdown();
      expect(mode.ui.stop).toHaveBeenCalled();
    });

    it('exits process', async () => {
      const mode = new (InteractiveMode as any)(runtime);
      await mode.shutdown();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('unregisters signal handlers after init', async () => {
      const mode = new (InteractiveMode as any)(runtime);
      await (mode as any).init();
      await mode.shutdown();
      expect(mockOff).toHaveBeenCalled();
      const calls = mockOff.mock.calls.map((args: any[]) => args[0]);
      expect(calls).toContain('SIGINT');
      expect(calls).toContain('SIGTERM');
    });
  });

  describe('prompt flow', () => {
    it('calls session.prompt on submit', async () => {
      const mode = new (InteractiveMode as any)(runtime);
      await (mode as any).init();
      mode.defaultEditor.getText = () => 'test';
      mode.defaultEditor.setText = jest.fn();
      const submitHandler = mode.defaultEditor.on.mock.calls.find((c: any) => c[0] === 'submit')[1];
      await submitHandler('test');
      expect(session.prompt).toHaveBeenCalledWith('test');
    });

    it('clears editor after submit', async () => {
      const mode = new (InteractiveMode as any)(runtime);
      await (mode as any).init();
      mode.defaultEditor.getText = () => 'test';
      mode.defaultEditor.setText = jest.fn();
      const submitHandler = mode.defaultEditor.on.mock.calls.find((c: any) => c[0] === 'submit')[1];
      await submitHandler('test');
      expect(mode.defaultEditor.setText).toHaveBeenCalledWith('');
    });

    it('renders UserMessageComponent on submit', async () => {
      const mode = new (InteractiveMode as any)(runtime);
      await (mode as any).init();
      mode.defaultEditor.getText = () => 'test';
      const { UserMessageComponent } = await import('@earendil-works/pi-coding-agent');
      const submitHandler = mode.defaultEditor.on.mock.calls.find((c: any) => c[0] === 'submit')[1];
      await submitHandler('test');
      expect(mode.chatContainer.addChild).toHaveBeenCalledWith(expect.any(UserMessageComponent));
    });

    it('logs prompt errors', async () => {
      session.prompt = jest.fn().mockRejectedValue(new Error('fail'));
      const log = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mode = new (InteractiveMode as any)(runtime);
      await (mode as any).init();
      mode.defaultEditor.getText = () => 'test';
      const submitHandler = mode.defaultEditor.on.mock.calls.find((c: any) => c[0] === 'submit')[1];
      await submitHandler('test');
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Prompt error'), expect.anything());
      log.mockRestore();
    });
  });

  describe('showLoadedResources', () => {
    it('should list all resources', async () => {
      const mode = new (InteractiveMode as any)(runtime);
      await (mode as any).init();

      session.resourceLoader = {
        getSkills: () => ({ skills: [{ name: 'skill1', description: 'desc1' }, { name: 'skill2' }] }),
        getPrompts: () => ({ prompts: [{ name: 'prompt1' }, { name: 'prompt2' }, { name: 'prompt3' }] }),
        getExtensions: () => ({ extensions: [{ name: 'ext1', version: '1.0' }] }),
        getThemes: () => ({ themes: [{ name: 'theme1' }, { name: 'theme2' }] }),
        getAgentsFiles: () => ({ agentsFiles: [{ name: 'agent1' }] }),
      };

      await (mode as any).showLoadedResources();

      expect(mode.chatContainer.addChild).toHaveBeenCalled();
      const calls = mode.chatContainer.addChild.mock.calls;
      const lastCall = calls[calls.length - 1];
      const textArg = lastCall[0];
      expect(textArg.text).toContain('Skills');
      expect(textArg.text).toContain('Prompts');
    });

    it('should handle empty resources', async () => {
      const mode = new (InteractiveMode as any)(runtime);
      await (mode as any).init();

      session.resourceLoader = {
        getSkills: () => ({ skills: [] }),
        getPrompts: () => ({ prompts: [] }),
        getExtensions: () => ({ extensions: [] }),
        getThemes: () => ({ themes: [] }),
        getAgentsFiles: () => ({ agentsFiles: [] }),
      };

      await (mode as any).showLoadedResources();

      expect(mode.chatContainer.addChild).toHaveBeenCalled();
      const calls = mode.chatContainer.addChild.mock.calls;
      const lastCall = calls[calls.length - 1];
      const textArg = lastCall[0];
      expect(textArg.text).toContain('No resources loaded');
    });

    it('should log error if resourceLoader throws', async () => {
      const mode = new (InteractiveMode as any)(runtime);
      await (mode as any).init();

      session.resourceLoader = {
        getSkills: () => { throw new Error('fail'); },
        getPrompts: () => ({ prompts: [] }),
        getExtensions: () => ({ extensions: [] }),
        getThemes: () => ({ themes: [] }),
        getAgentsFiles: () => ({ agentsFiles: [] }),
      };

      const logSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await (mode as any).showLoadedResources();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Error loading resources'), expect.anything());
      logSpy.mockRestore();
    });
  });

  describe('renderInitialMessages', () => {
    it('should render user and assistant messages from session.state', async () => {
      const mode = new (InteractiveMode as any)(runtime);
      await (mode as any).init();

      session.state = {
        messages: [
          { role: 'user', content: [{ type: 'text', text: 'hello' }] },
          { role: 'assistant', content: [{ type: 'text', text: 'hi' }] },
        ],
      };

      mode.chatContainer.addChild = jest.fn();

      await (mode as any).renderInitialMessages();

      expect(mode.chatContainer.addChild).toHaveBeenCalledTimes(2);
    });

    it('should handle empty messages', async () => {
      const mode = new (InteractiveMode as any)(runtime);
      await (mode as any).init();

      session.state = { messages: [] };
      mode.chatContainer.addChild = jest.fn();

      await (mode as any).renderInitialMessages();

      expect(mode.chatContainer.addChild).not.toHaveBeenCalled();
    });
  });

  describe('bindCurrentSessionExtensions', () => {
    it('should setup autocomplete provider', async () => {
      const mode = new (InteractiveMode as any)(runtime);
      await (mode as any).init();

      mode.defaultEditor = { setAutocomplete: jest.fn() };
      session.resourceLoader = {
        getSkills: () => ({ skills: [{ name: 's1' }] }),
        getPrompts: () => ({ prompts: [{ name: 'p1' }] }),
        getExtensions: () => ({ extensions: [] }),
        getThemes: () => ({ themes: [] }),
      };

      await (mode as any).bindCurrentSessionExtensions();

      expect(mode.defaultEditor.setAutocomplete).toHaveBeenCalled();
    });
  });

  describe('slash commands and UI', () => {
    it('invokes showThinkingSelector on /thinking', async () => {
      const mode = new InteractiveMode(runtime);
      await mode.init();
      const spy = jest.spyOn(mode as any, 'showThinkingSelector');
      await (mode as any).handleSlashCommand('/thinking');
      expect(spy).toHaveBeenCalled();
    });

    it('invokes showModelSelector on /models', async () => {
      const mode = new InteractiveMode(runtime);
      await mode.init();
      const spy = jest.spyOn(mode as any, 'showModelSelector');
      await (mode as any).handleSlashCommand('/models');
      expect(spy).toHaveBeenCalled();
    });

    it('showThinkingSelector calls ui.showOverlay', async () => {
      const mode = new InteractiveMode(runtime);
      await mode.init();
      await (mode as any).showThinkingSelector();
      expect((mode as any).ui.showOverlay).toHaveBeenCalled();
    });

    it('showModelSelector calls ui.showOverlay', async () => {
      const mode = new InteractiveMode(runtime);
      await mode.init();
      await (mode as any).showModelSelector();
      expect((mode as any).ui.showOverlay).toHaveBeenCalled();
    });
  });
});
