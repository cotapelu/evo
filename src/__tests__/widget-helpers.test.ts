#!/usr/bin/env node
/**
 * Widget Helpers Tests
 */

import { vi, describe, it, expect } from 'vitest';
import { addSectionHeader } from '@extensions/utils/widget-helpers';

// Mock pi-tui
vi.mock('@earendil-works/pi-tui', () => ({
  Container: class Container {
    children: any[] = [];
    addChild(child: any) { this.children.push(child); }
  },
  Text: class Text {
    constructor(public text: string) {}
  },
  Spacer: class Spacer {},
}));

describe('widget-helpers', () => {
  it('addSectionHeader adds styled title and spacer', () => {
    const { Container, Text, Spacer } = require('@earendil-works/pi-tui');
    const container = new Container();
    const theme = {
      fg: (_color: string, s: string) => s,
      bold: (s: string) => `**${s}**`,
    };
    addSectionHeader(container, theme, 'My Title');

    expect(container.children.length).toBe(2);
    const first = container.children[0];
    expect(first.constructor.name).toBe('Text');
    expect((first as any).text).toBe('**My Title**');
    const second = container.children[1];
    expect(second.constructor.name).toBe('Spacer');
  });

  it('addSectionHeader handles empty title', () => {
    const { Container } = require('@earendil-works/pi-tui');
    const container = new Container();
    const theme = {
      fg: (_c: string, s: string) => s,
      bold: (s: string) => s,
    };
    addSectionHeader(container, theme, '');
    expect(container.children.length).toBe(2);
    const first = container.children[0];
    expect(first.constructor.name).toBe('Text');
    expect((first as any).text).toBe('');
    expect(container.children[1].constructor.name).toBe('Spacer');
  });
});
