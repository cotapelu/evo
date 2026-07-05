import { describe, it, expect } from 'vitest';
import {
  extractSessionIdFromPath,
  buildHandoffBusPaths,
} from '../extensions/session-tool/handoff.ts';

describe('extractSessionIdFromPath', () => {
  it('should extract session ID from filename with .jsonl extension', () => {
    // Always prepends 'session_' after sanitization
    expect(extractSessionIdFromPath('/path/to/session_abc123.jsonl')).toBe('session_session_abc123');
    expect(extractSessionIdFromPath('session_xyz.jsonl')).toBe('session_session_xyz');
  });

  it('should handle filenames without .jsonl extension', () => {
    expect(extractSessionIdFromPath('/path/to/session_abc123')).toBe('session_session_abc123');
    expect(extractSessionIdFromPath('session_xyz')).toBe('session_session_xyz');
  });

  it('should replace invalid characters with underscores', () => {
    expect(extractSessionIdFromPath('/path/with@special!chars.jsonl')).toBe('session_with_special_chars');
    expect(extractSessionIdFromPath('/my-session_id.jsonl')).toBe('session_my_session_id');
  });

  it('should lowercase the result', () => {
    expect(extractSessionIdFromPath('/path/To/SESSION_ABC.jsonl')).toBe('session_session_abc');
  });

  it('should handle empty or malformed paths', () => {
    expect(extractSessionIdFromPath('')).toBe('session_'); // filename is ''
    expect(extractSessionIdFromPath('/')).toBe('session_'); // filename is ''
    expect(extractSessionIdFromPath('.jsonl')).toBe('session_.jsonl'); // filename is '.jsonl', base empty so uses original filename
  });

  it('should handle paths with multiple dots', () => {
    // Note: base is sanitized (dots to underscores), then 'session_' prefix added
    expect(extractSessionIdFromPath('/path/to/session.123.jsonl')).toBe('session_session_123');
    expect(extractSessionIdFromPath('/path.to/file.session.jsonl')).toBe('session_file_session');
  });
});

describe('buildHandoffBusPaths', () => {
  it('should build valid paths for a clean session ID', () => {
    const result = buildHandoffBusPaths('my-session-123');
    expect(result.sessionId).toBe('my-session-123');
    expect(result.busFile).toBe('docs/session_handoffs/my-session-123/bus.md');
    expect(result.outputFile).toBe('docs/session_handoffs/my-session-123/output.md');
    expect(result.statusFile).toBe('docs/session_handoffs/my-session-123/status.json');
  });

  it('should sanitize session ID with special characters', () => {
    const result = buildHandoffBusPaths('session/with/slashes');
    expect(result.sessionId).toBe('session_with_slashes');
    expect(result.busFile).toBe('docs/session_handoffs/session_with_slashes/bus.md');
  });

  it('should handle session IDs with dots and spaces', () => {
    const result = buildHandoffBusPaths('session.id with spaces');
    expect(result.sessionId).toBe('session_id_with_spaces');
  });

  it('should handle empty session ID', () => {
    const result = buildHandoffBusPaths('');
    expect(result.sessionId).toBe('');
    expect(result.busFile).toBe('docs/session_handoffs//bus.md');
  });

  it('should preserve allowed characters (alphanumeric, underscore, hyphen)', () => {
    const result = buildHandoffBusPaths('abc_123-xyz');
    expect(result.sessionId).toBe('abc_123-xyz');
    expect(result.busFile).toBe('docs/session_handoffs/abc_123-xyz/bus.md');
  });
});
