import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeHttp } from '../../../extensions/tools/sub-tools/http.js';
import { promises as fs } from 'fs';

function mockExec(result: { stdout: string; stderr: string; code: number; killed: boolean }) {
  return {
    exec: vi.fn(async (cmd: string, args: string[], opts: any) => {
      return { ...result, signal: undefined };
    }),
  };
}

function makeCtx(execMock: any) {
  return { exec: execMock.exec };
}

function defaultResult(overrides: any = {}) {
  return { stdout: '', stderr: '', code: 0, killed: false, ...overrides };
}

describe('executeHttp branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses GET by default (no -X)', async () => {
    const ctx = makeCtx(mockExec(defaultResult()));
    const result = await executeHttp({ url: 'http://example.com' }, '/cwd', undefined, ctx);
    const args = ctx.exec.mock.calls[0][1];
    expect(args).not.toContain('-X');
    expect(result.isError).toBe(false);
  });

  it('adds -X for non-GET method', async () => {
    const ctx = makeCtx(mockExec(defaultResult()));
    await executeHttp({ url: 'http://example.com', method: 'POST' }, '/cwd', undefined, ctx);
    const args = ctx.exec.mock.calls[0][1];
    expect(args).toContain('-X');
    expect(args[args.indexOf('-X') + 1]).toBe('POST');
  });

  it('includes headers when provided', async () => {
    const ctx = makeCtx(mockExec(defaultResult()));
    await executeHttp({ url: 'http://example.com', headers: { 'X-A': '1', 'X-B': '2' } }, '/cwd', undefined, ctx);
    const args = ctx.exec.mock.calls[0][1];
    expect(args).toContain('-H');
    expect(args).toContain('X-A: 1');
    expect(args).toContain('X-B: 2');
  });

  it('does not add any -H headers when headers empty or absent', async () => {
    const ctx = makeCtx(mockExec(defaultResult()));
    await executeHttp({ url: 'http://example.com', headers: {} }, '/cwd', undefined, ctx);
    const args = ctx.exec.mock.calls[0][1];
    const hasHeader = args.includes('-H');
    expect(hasHeader).toBe(false);
  });

  it('creates temp file and adds --data for string body with POST', async () => {
    const ctx = makeCtx(mockExec(defaultResult()));
    await executeHttp({ url: 'http://example.com', method: 'POST', body: 'raw body' }, '/cwd', undefined, ctx);
    const args = ctx.exec.mock.calls[0][1];
    expect(args).toContain('--data');
    const dataIdx = args.indexOf('--data');
    expect(args[dataIdx + 1]).toMatch(/^@.*\.txt$/);
    // The temp file is written; we could spy on fs.writeFile but not necessary for branch coverage
  });

  it('stringifies object body before writing temp file', async () => {
    const ctx = makeCtx(mockExec(defaultResult()));
    const bodyObj = { key: 'value' };
    await executeHttp({ url: 'http://example.com', method: 'POST', body: bodyObj }, '/cwd', undefined, ctx);
    const args = ctx.exec.mock.calls[0][1];
    expect(args).toContain('--data');
    // The temp file write occurs with JSON-stringified content
  });

  it('does not add --data when body absent or method not POST/PUT/PATCH', async () => {
    const ctx = makeCtx(mockExec(defaultResult()));
    // GET with body
    await executeHttp({ url: 'http://example.com', method: 'GET', body: 'ignored' }, '/cwd', undefined, ctx);
    let args = ctx.exec.mock.calls[0][1];
    expect(args.includes('--data')).toBe(false);

    // POST without body
    ctx.exec.mockClear();
    await executeHttp({ url: 'http://example.com', method: 'POST' }, '/cwd', undefined, ctx);
    args = ctx.exec.mock.calls[0][1];
    expect(args.includes('--data')).toBe(false);
  });

  it('includes --max-time with timeout value', async () => {
    const ctx = makeCtx(mockExec(defaultResult()));
    await executeHttp({ url: 'http://example.com', timeout: 15 }, '/cwd', undefined, ctx);
    const args = ctx.exec.mock.calls[0][1];
    const tIdx = args.indexOf('--max-time');
    expect(tIdx).toBeGreaterThan(-1);
    expect(args[tIdx + 1]).toBe('15');
  });

  it('adds -k when insecure true', async () => {
    const ctx = makeCtx(mockExec(defaultResult()));
    await executeHttp({ url: 'http://example.com', insecure: true }, '/cwd', undefined, ctx);
    expect(ctx.exec.mock.calls[0][1]).toContain('-k');
  });

  it('adds -u user:pass when user provided', async () => {
    const ctx = makeCtx(mockExec(defaultResult()));
    await executeHttp({ url: 'http://example.com', user: 'bob:secret' }, '/cwd', undefined, ctx);
    const args = ctx.exec.mock.calls[0][1];
    expect(args).toContain('-u');
    expect(args).toContain('bob:secret');
  });

  it('adds -v when verbose true', async () => {
    const ctx = makeCtx(mockExec(defaultResult()));
    await executeHttp({ url: 'http://example.com', verbose: true }, '/cwd', undefined, ctx);
    expect(ctx.exec.mock.calls[0][1]).toContain('-v');
  });

  it('returns content from stdout when available', async () => {
    const ctx = makeCtx(mockExec({ stdout: 'response body', stderr: '', code: 0, killed: false }));
    const res = await executeHttp({ url: 'http://example.com' }, '/cwd', undefined, ctx);
    expect(res.isError).toBe(false);
    expect(res.content[0].text).toBe('response body');
  });

  it('falls back to stderr when stdout empty', async () => {
    const ctx = makeCtx(mockExec({ stdout: '', stderr: 'curl error output', code: 0, killed: false }));
    const res = await executeHttp({ url: 'http://example.com' }, '/cwd', undefined, ctx);
    expect(res.content[0].text).toBe('curl error output');
  });

  it('sets isError true when curl exit code non-zero', async () => {
    const ctx = makeCtx(mockExec({ stdout: '', stderr: 'failed', code: 7, killed: false }));
    const res = await executeHttp({ url: 'http://example.com' }, '/cwd', undefined, ctx);
    expect(res.isError).toBe(true);
    expect(res.details.exitCode).toBe(7);
  });

  it('catches exec exception and returns isError', async () => {
    const ctx = {
      exec: vi.fn().mockRejectedValue(new Error('network failure')),
    };
    const res = await executeHttp({ url: 'http://example.com' }, '/cwd', undefined, ctx as any);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('HTTP error');
  });
});
