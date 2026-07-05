import { describe, it, expect, vi } from 'vitest';
import {
  renderError,
  renderSuccess,
  renderMuted,
  renderAccent,
  renderWarning,
  styleError,
  styleSuccess,
  styleMuted,
  styleAccent,
  styleWarning,
  styleText,
} from '../../extensions/utils/render-utils.js';
import { Text } from '@earendil-works/pi-tui';

// Mock theme
function createMockTheme() {
  return {
    fg: vi.fn((color: string, text: string) => `[${color}:${text}]`),
    bold: vi.fn((text: string) => `**${text}**`),
  };
}

describe('Render Utils', () => {
  let theme: ReturnType<typeof createMockTheme>;

  beforeEach(() => {
    theme = createMockTheme();
    vi.clearAllMocks();
  });

  describe('render* functions (return Text)', () => {
    it('renderError should return Text with error color', () => {
      const result = renderError(theme, 'Oops');
      expect(result).toBeInstanceOf(Text);
      expect(result.text).toBe('[error:Oops]');
      expect(theme.fg).toHaveBeenCalledWith('error', 'Oops');
    });

    it('renderSuccess should return Text with success color', () => {
      const result = renderSuccess(theme, 'Done');
      expect(result).toBeInstanceOf(Text);
      expect(result.text).toBe('[success:Done]');
    });

    it('renderMuted should return Text with muted color', () => {
      const result = renderMuted(theme, 'Dim');
      expect(result).toBeInstanceOf(Text);
      expect(result.text).toBe('[muted:Dim]');
    });

    it('renderAccent should return Text with accent color', () => {
      const result = renderAccent(theme, 'Highlight');
      expect(result).toBeInstanceOf(Text);
      expect(result.text).toBe('[accent:Highlight]');
    });

    it('renderWarning should return Text with warning color', () => {
      const result = renderWarning(theme, 'Careful');
      expect(result).toBeInstanceOf(Text);
      expect(result.text).toBe('[warning:Careful]');
    });
  });

  describe('style* functions (return string)', () => {
    it('styleError should return styled string', () => {
      const result = styleError(theme, 'Bad');
      expect(result).toBe('[error:Bad]');
    });

    it('styleSuccess should return styled string', () => {
      const result = styleSuccess(theme, 'Good');
      expect(result).toBe('[success:Good]');
    });

    it('styleMuted should return styled string', () => {
      const result = styleMuted(theme, 'Quiet');
      expect(result).toBe('[muted:Quiet]');
    });

    it('styleAccent should return styled string', () => {
      const result = styleAccent(theme, 'Pop');
      expect(result).toBe('[accent:Pop]');
    });

    it('styleWarning should return styled string', () => {
      const result = styleWarning(theme, 'Alert');
      expect(result).toBe('[warning:Alert]');
    });

    it('styleText should return text color', () => {
      const result = styleText(theme, 'Normal');
      expect(result).toBe('[text:Normal]');
    });
  });

  describe('integration: combining style functions', () => {
    it('should allow nesting styles via concatenation', () => {
      const error = styleError(theme, 'Failed');
      const accent = styleAccent(theme, 'Important');
      const combined = `${error} - ${accent}`;
      expect(combined).toBe('[error:Failed] - [accent:Important]');
    });
  });
});
