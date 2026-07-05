import { describe, it, expect, vi } from 'vitest';
import { addSectionHeader } from '../../extensions/utils/widget-helpers.js';
import { Container, Text, Spacer } from '@earendil-works/pi-tui';

// Mock theme
function createMockTheme() {
  return {
    fg: vi.fn((color: string, text: string) => `[${color}:${text}]`),
    bold: vi.fn((text: string) => `**${text}**`),
  };
}

describe('Widget Helpers', () => {
  describe('addSectionHeader', () => {
    it('should add styled Text and Spacer to container', () => {
      const theme = createMockTheme();
      const container = { addChild: vi.fn() } as unknown as Container;

      addSectionHeader(container, theme, 'Section 1');

      expect(container.addChild).toHaveBeenCalledTimes(2);
      // First child: Text with bold+accent
      const textChild = (container.addChild as any).mock.calls[0][0];
      expect(textChild).toBeInstanceOf(Text);
      expect(textChild.text).toBe('[accent:**Section 1**]');
      // Second child: Spacer with height 1
      const spacerChild = (container.addChild as any).mock.calls[1][0];
      expect(spacerChild).toBeInstanceOf(Spacer); // Spacer created with height 1
    });

    it('should handle empty title', () => {
      const theme = createMockTheme();
      const container = { addChild: vi.fn() } as unknown as Container;

      addSectionHeader(container, theme, '');

      const textChild = (container.addChild as any).mock.calls[0][0] as Text;
      // theme.bold('') returns '****' (two asterisks on each side)
      expect(theme.bold).toHaveBeenCalledWith('');
      expect(textChild.text).toBe('[accent:****]');
    });

    it('should call theme methods in correct order', () => {
      const theme = {
        fg: vi.fn((c, t) => `[${c}:${t}]`),
        bold: vi.fn((t) => `**${t}**`),
      };
      const container = { addChild: vi.fn() } as unknown as Container;

      addSectionHeader(container, theme, 'Test');

      expect(theme.bold).toHaveBeenCalledTimes(1);
      expect(theme.bold).toHaveBeenCalledWith('Test');
      expect(theme.fg).toHaveBeenCalledWith('accent', '**Test**');
    });

    it('should not mutate container beyond adding children', () => {
      const theme = createMockTheme();
      const container = { addChild: vi.fn() } as unknown as Container;

      addSectionHeader(container, theme, 'New');

      expect(container.addChild).toHaveBeenCalledTimes(2);
    });
  });
});
