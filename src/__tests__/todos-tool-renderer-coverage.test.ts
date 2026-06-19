#!/usr/bin/env node
/**
 * Todos Tool Renderer Coverage
 *
 * Tests renderCall and renderResult functions to increase branch coverage.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTodosTool } from '@extensions/tools/todos-tool';
import { createMockExtensionAPI } from '../tests/utils/mock-factory.js';

function createMockTheme() {
  return {
    fg: (color: string, text: string) => text,
    bold: (text: string) => text,
  };
}

describe('Todos Tool Renderer Coverage', () => {
  let tool: any;

  beforeEach(() => {
    const api = createMockExtensionAPI();
    registerTodosTool(api);
    tool = api.registerTool.mock.calls[0][0];
  });

  describe('renderCall', () => {
    it('renders add_task action', () => {
      const comp = tool.renderCall({ add_task: true, text: 'new task' }, createMockTheme(), {});
      expect(comp.text).toContain('todos');
      expect(comp.text).toContain('add_task');
    });

    it('renders list action', () => {
      const comp = tool.renderCall({ list: true }, createMockTheme(), {});
      expect(comp.text).toContain('list');
    });

    it('renders update action', () => {
      const comp = tool.renderCall({ update: { id: 1, status: 'completed' } }, createMockTheme(), {});
      expect(comp.text).toContain('update');
    });

    it('renders delete action', () => {
      const comp = tool.renderCall({ delete: 2 }, createMockTheme(), {});
      expect(comp.text).toContain('delete');
    });

    it('renders add_phase action', () => {
      const comp = tool.renderCall({ add_phase: { name: 'New Phase' } }, createMockTheme(), {});
      expect(comp.text).toContain('add_phase');
    });

    it('renders remove_task action', () => {
      const comp = tool.renderCall({ remove_task: 't1' }, createMockTheme(), {});
      expect(comp.text).toContain('remove_task');
    });

    it('defaults to todo when no recognized arg', () => {
      const comp = tool.renderCall({ }, createMockTheme(), {});
      expect(comp.text).toContain('todo');
    });
  });

  describe('renderResult', () => {
    it('returns empty Text if details missing', () => {
      const comp = tool.renderResult({ details: undefined }, { expanded: false, isPartial: false }, createMockTheme());
      expect(comp.text).toBe('');
    });

    it('renders error when details.error present', () => {
      const comp = tool.renderResult({ details: { error: 'something went wrong' } }, { expanded: false, isPartial: false }, createMockTheme());
      expect(comp.text).toContain('Error: something went wrong');
    });

    it('renders processing when isPartial true', () => {
      const comp = tool.renderResult({ details: {} }, { expanded: false, isPartial: true }, createMockTheme());
      expect(comp.text).toContain('Processing...');
    });

    it('renders "No todos" when phases empty', () => {
      const comp = tool.renderResult({ details: { phases: [] } }, { expanded: false, isPartial: false }, createMockTheme());
      expect(comp.text).toContain('No todos');
    });

    it('renders header with task count', () => {
      const phases = [{ name: 'Phase 1', tasks: [{ id: '1', content: 'Task 1', status: 'pending' }] }];
      const comp = tool.renderResult({ details: { phases } }, { expanded: false, isPartial: false }, createMockTheme());
      expect(comp.text).toContain('Todos: 1 tasks');
    });

    it('shows phase name when multiple phases', () => {
      const phases = [
        { name: 'Phase A', tasks: [{ id: '1', content: 'T1', status: 'pending' }] },
        { name: 'Phase B', tasks: [{ id: '2', content: 'T2', status: 'pending' }] }
      ];
      const comp = tool.renderResult({ details: { phases } }, { expanded: false, isPartial: false }, createMockTheme());
      expect(comp.text).toContain('▼ Phase A');
      expect(comp.text).toContain('▼ Phase B');
    });

    it('truncates tasks when not expanded and >5', () => {
      const many = Array.from({ length: 7 }, (_, i) => ({ id: `${i+1}`, content: `Task ${i+1}`, status: 'pending' }));
      const phases = [{ name: 'Phase 1', tasks: many }];
      const comp = tool.renderResult({ details: { phases } }, { expanded: false, isPartial: false }, createMockTheme());
      expect(comp.text).toContain('... 2 more');
    });

    it('shows all tasks when expanded', () => {
      const many = Array.from({ length: 3 }, (_, i) => ({ id: `${i+1}`, content: `Task ${i+1}`, status: 'pending' }));
      const phases = [{ name: 'Phase 1', tasks: many }];
      const comp = tool.renderResult({ details: { phases } }, { expanded: true, isPartial: false }, createMockTheme());
      expect(comp.text).toContain('Task 1');
      expect(comp.text).toContain('Task 2');
      expect(comp.text).toContain('Task 3');
      expect(comp.text).not.toContain('...');
    });

    it('renders completed task with checkmark', () => {
      const phases = [{ name: 'Done', tasks: [{ id: '1', content: 'Finished', status: 'completed' }] }];
      const comp = tool.renderResult({ details: { phases } }, { expanded: false, isPartial: false }, createMockTheme());
      expect(comp.text).toContain('✓');
    });

    it('renders abandoned task with cross', () => {
      const phases = [{ name: 'Cancelled', tasks: [{ id: '1', content: 'Canceled', status: 'abandoned' }] }];
      const comp = tool.renderResult({ details: { phases } }, { expanded: false, isPartial: false }, createMockTheme());
      expect(comp.text).toContain('✗');
    });

    it('renders in_progress task with arrow and details', () => {
      const phases = [{ name: 'Working', tasks: [{ id: '1', content: 'WIP', status: 'in_progress', details: 'Blocked by X' }] }];
      const comp = tool.renderResult({ details: { phases } }, { expanded: false, isPartial: false }, createMockTheme());
      expect(comp.text).toContain('→');
      expect(comp.text).toContain('Blocked by X');
    });

    it('renders pending task with space', () => {
      const phases = [{ name: 'Todo', tasks: [{ id: '1', content: 'Pending', status: 'pending' }] }];
      const comp = tool.renderResult({ details: { phases } }, { expanded: false, isPartial: false }, createMockTheme());
      // Pending has a space prefix; check for id and content
      expect(comp.text).toContain('1 Pending');
    });
  });
});
