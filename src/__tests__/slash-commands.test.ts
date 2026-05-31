import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock modules before import (phải trước khi import InteractiveMode)
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
  Container: jest.fn().mockImplementation(() => {
    const instance = {
      children: [],
      addChild: jest.fn(function(child) { instance.children.push(child); }),
      removeChild: jest.fn(function(child) { instance.children = instance.children.filter(c => c !== child); }),
      clear: jest.fn(function() { instance.children = []; }),
    };
    return instance;
  }),
  Text: (jest.fn() as any).mockImplementation((text?: string, px?: number, py?: number) => ({ text, px, py })),
  Spacer: jest.fn(),
  ExpandableText: jest.fn(),
  setKeybindings: jest.fn(),
  CombinedAutocompleteProvider: jest.fn(),
  fuzzyFilter: (items: any[], prefix: string, fn: any) => items,
  Markdown: jest.fn(),
  matchesKey: jest.fn(),
  Loader: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
  })),
  SelectList: jest.fn().mockImplementation(() => ({
    handleInput: jest.fn(),
    onSelect: undefined as any,
    onCancel: undefined as any,
    setSelected: jest.fn(),
  })),
  TUI_KEYBINDINGS: {},
}));

await jest.unstable_mockModule('@earendil-works/pi-coding-agent', () => ({
  AgentSessionRuntime: jest.fn(),
  CustomEditor: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    off: jest.fn(),
    setText: jest.fn(),
    getText: () => '',
    onSubmit: undefined as any,
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
  ToolExecutionComponent: jest.fn().mockImplementation(() => ({
    setExpanded: jest.fn(),
    appendOutput: jest.fn(),
    setComplete: jest.fn(),
  })),
  ModelSelectorComponent: jest.fn().mockImplementation(() => ({})),
  SettingsSelectorComponent: jest.fn().mockImplementation(() => ({})),
  ThinkingSelectorComponent: jest.fn().mockImplementation(() => ({})),
  SessionSelectorComponent: jest.fn().mockImplementation(() => ({})),
  TreeSelectorComponent: jest.fn().mockImplementation(() => ({})),
  Summarizer: { summarize: jest.fn().mockResolvedValue(undefined) },
  // Utils
  getChangelogPath: jest.fn().mockReturnValue('/path/to/changelog.md'),
  parseChangelog: jest.fn().mockReturnValue({ entries: [] }),
  checkForNewPiVersion: jest.fn().mockResolvedValue(null),
  killTrackedDetachedChildren: jest.fn(),
  initTheme: jest.fn(),
  keyHint: jest.fn((a) => a),
  keyText: jest.fn((a) => a),
  rawKeyHint: jest.fn((a, b) => a),
});

// Now import after mocks are set
import { InteractiveMode } from '../interactive/interactive-mode';
import { theme } from '../interactive/theme/theme';

// Helper to create a fresh session mock
function createSession(): any {
  return {
    state: { messages: [] },
    settingsManager: {
      getShowHardwareCursor: jest.fn().mockReturnValue(true),
      getClearOnShrink: jest.fn().mockReturnValue(true),
      getEditorPaddingX: jest.fn().mockReturnValue(2),
      getAutocompleteMaxVisible: jest.fn().mockReturnValue(8),
      getCodeBlockIndent: jest.fn().mockReturnValue(2),
      getShowImages: jest.fn().mockReturnValue(true),
      getImageWidthCells: jest.fn().mockReturnValue(40),
    },
    sessionManager: { getCwd: jest.fn().mockReturnValue('/tmp'), getSessionDir: jest.fn().mockReturnValue('/tmp/sessions') },
    modelRegistry: { getAvailable: jest.fn().mockReturnValue([]) },
    resourceLoader: {
      getSkills: jest.fn().mockReturnValue({ skills: [] }),
      getPrompts: jest.fn().mockReturnValue({ prompts: [] }),
      getExtensions: jest.fn().mockReturnValue({ extensions: [] }),
      getThemes: jest.fn().mockReturnValue({ themes: [] }),
      reloadExtensions: jest.fn().mockResolvedValue(undefined),
    },
    subscribe: jest.fn().mockImplementation((cb: any) => {
      const sess: any = this;
      sess._cb = cb;
      return () => { sess._cb = undefined; };
    }),
    agent: { waitForIdle: jest.fn(), interrupt: jest.fn() },
    autoCompactionEnabled: false,
    compact: jest.fn().mockResolvedValue(undefined),
    cycleModel: jest.fn().mockReturnValue({ model: { id: 'gpt-4' } }),
    // Methods that may be called by slash commands
    renameSession: jest.fn().mockResolvedValue(undefined),
    cloneSession: jest.fn().mockResolvedValue(undefined),
    forkSession: jest.fn().mockResolvedValue(undefined),
    // Not used directly but for completeness
    setThinkingLevel: jest.fn().mockResolvedValue(undefined),
  };
}

describe('InteractiveMode additional slash commands', () => {
  let runtime: any;
  let session: any;
  let mode: any;

  beforeEach(async () => {
    session = createSession();
    runtime = { session, switchSession: jest.fn().mockResolvedValue({}) };
    mode = new InteractiveMode(runtime);
    // Spy on methods that we expect handleSlashCommand to call.
    // We'll replace them with jest.fn to track calls.
    mode.showHotkeys = jest.fn();
    mode.reloadResources = jest.fn();
    mode.toggleDebug = jest.fn();
    mode.showChangelog = jest.fn();
    mode.renameSession = jest.fn();
    mode.cloneSession = jest.fn();
    mode.forkSession = jest.fn();
    mode.exportSession = jest.fn();
    mode.importSession = jest.fn();
    mode.showWarning = jest.fn();
    mode.handleModelCommand = jest.fn(); // prevent default model handling interfering
    // Init will subscribe etc.
    await (mode as any).init();
  });

  it('routes /hotkeys to showHotkeys', async () => {
    await (mode as any).handleSlashCommand('/hotkeys');
    expect(mode.showHotkeys).toHaveBeenCalled();
  });

  it('routes /reload to reloadResources', async () => {
    await (mode as any).handleSlashCommand('/reload');
    expect(mode.reloadResources).toHaveBeenCalled();
  });

  it('routes /debug to toggleDebug', async () => {
    await (mode as any).handleSlashCommand('/debug');
    expect(mode.toggleDebug).toHaveBeenCalled();
  });

  it('routes /changelog to showChangelog', async () => {
    await (mode as any).handleSlashCommand('/changelog');
    expect(mode.showChangelog).toHaveBeenCalled();
  });

  it('routes /name <arg> to renameSession', async () => {
    await (mode as any).handleSlashCommand('/name MySession');
    expect(mode.renameSession).toHaveBeenCalledWith('MySession');
  });

  it('shows warning for /name without arg', async () => {
    await (mode as any).handleSlashCommand('/name');
    expect(mode.showWarning).toHaveBeenCalledWith('Usage: /name <new name>');
  });

  it('routes /clone <arg> to cloneSession', async () => {
    await (mode as any).handleSlashCommand('/clone CopyName');
    expect(mode.cloneSession).toHaveBeenCalledWith('CopyName');
  });

  it('shows warning for /clone without arg', async () => {
    await (mode as any).handleSlashCommand('/clone');
    expect(mode.showWarning).toHaveBeenCalledWith('Usage: /clone <new session name>');
  });

  it('routes /fork <arg> to forkSession', async () => {
    await (mode as any).handleSlashCommand('/fork Forked');
    expect(mode.forkSession).toHaveBeenCalledWith('Forked');
  });

  it('shows warning for /fork without arg', async () => {
    await (mode as any).handleSlashCommand('/fork');
    expect(mode.showWarning).toHaveBeenCalledWith('Usage: /fork <new session name>');
  });

  it('routes /export (no arg) to exportSession with undefined', async () => {
    await (mode as any).handleSlashCommand('/export');
    expect(mode.exportSession).toHaveBeenCalledWith(undefined);
  });

  it('routes /export <file> to exportSession with file', async () => {
    await (mode as any).handleSlashCommand('/export backup.json');
    expect(mode.exportSession).toHaveBeenCalledWith('backup.json');
  });

  it('routes /import <file> to importSession', async () => {
    await (mode as any).handleSlashCommand('/import backup.json');
    expect(mode.importSession).toHaveBeenCalledWith('backup.json');
  });

  it('shows warning for /import without arg', async () => {
    await (mode as any).handleSlashCommand('/import');
    expect(mode.showWarning).toHaveBeenCalledWith('Usage: /import <file path>');
  });
});
