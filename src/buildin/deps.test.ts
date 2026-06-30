import { describe, it, expect } from 'vitest';
import {
  createAgentSessionServices,
  createAgentSessionRuntime,
  createAgentSessionFromServices,
  InteractiveMode,
  SessionManager,
  createReadTool,
  createBashTool,
  createEditTool,
  createWriteTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  Type,
} from './deps.js';

describe('deps exports', () => {
  it('should export createAgentSessionServices as a function', () => {
    expect(typeof createAgentSessionServices).toBe('function');
  });

  it('should export createAgentSessionRuntime as a function', () => {
    expect(typeof createAgentSessionRuntime).toBe('function');
  });

  it('should export createAgentSessionFromServices as a function', () => {
    expect(typeof createAgentSessionFromServices).toBe('function');
  });

  it('should export InteractiveMode as a class/function', () => {
    expect(typeof InteractiveMode).toBe('function');
  });

  it('should export SessionManager with create method', () => {
    expect(typeof SessionManager.create).toBe('function');
  });

  it('should export createReadTool as a function', () => {
    expect(typeof createReadTool).toBe('function');
  });

  it('should export createBashTool as a function', () => {
    expect(typeof createBashTool).toBe('function');
  });

  it('should export createEditTool as a function', () => {
    expect(typeof createEditTool).toBe('function');
  });

  it('should export createWriteTool as a function', () => {
    expect(typeof createWriteTool).toBe('function');
  });

  it('should export createFindTool as a function', () => {
    expect(typeof createFindTool).toBe('function');
  });

  it('should export createGrepTool as a function', () => {
    expect(typeof createGrepTool).toBe('function');
  });

  it('should export createLsTool as a function', () => {
    expect(typeof createLsTool).toBe('function');
  });

  it('should export Type from typebox', () => {
    // Type from typebox is typically an object with static methods
    expect(typeof Type).toBe('object');
    expect(Type).toBeDefined();
  });
});
