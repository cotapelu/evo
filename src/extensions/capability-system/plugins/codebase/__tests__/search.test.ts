#!/usr/bin/env node
/**
 * Tests for codebase.search capability
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, unlink, readdir } from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { relative, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function writeTempFile(content: string, ext = "ts"): Promise<string> {
  const timestamp = Date.now();
  const dir = path.join(__dirname, "temp");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `test-${timestamp}.${ext}`);
  await writeFile(file, content, "utf-8");
  return file;
}

const searchModule = await import("../capabilities/search.ts");

describe("codebase.search", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(__dirname, "temp");
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      const files = await readdir(tempDir);
      for (const f of files) {
        await unlink(join(tempDir, f));
      }
    } catch {}
  });

  it("should find matches in a file", async () => {
    const file = join(tempDir, "sample.ts");
    await writeFile(file, "const x = 1;\nconst y = 2;\nconst z = x + y;", "utf-8");
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: "const" }, ctx as any);
    expect(result.isError).toBe(false);
    expect(result.details.total).toBe(3);
    expect(result.details.matches.length).toBe(3);
    // Each match should have file, line, column, text
    result.details.matches.forEach((m: any) => {
      expect(m.file).toContain("sample.ts");
      expect(typeof m.line).toBe("number");
      expect(typeof m.column).toBe("number");
      expect(typeof m.text).toBe("string");
    });
  });

  it("should be case-insensitive by default", async () => {
    const file = join(tempDir, "sample.ts");
    await writeFile(file, "CONST X = 1;\nconst y = 2;", "utf-8");
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: "const" }, ctx as any);
    expect(result.details.total).toBe(2);
  });

  it("should respect caseSensitive flag", async () => {
    const file = join(tempDir, "sample.ts");
    await writeFile(file, "CONST X = 1;\nconst y = 2;", "utf-8");
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: "const", caseSensitive: true }, ctx as any);
    expect(result.details.total).toBe(1); // only lowercase const
  });

  it("should respect maxResults", async () => {
    const file = join(tempDir, "sample.ts");
    await writeFile(file, "line1\nline2\nline3\nline4\nline5", "utf-8");
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: "line", maxResults: 2 }, ctx as any);
    expect(result.details.total).toBe(2);
  });

  it("should return no matches when none found", async () => {
    const file = join(tempDir, "sample.ts");
    await writeFile(file, "const x = 1;", "utf-8");
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: "nonexistent" }, ctx as any);
    expect(result.details.total).toBe(0);
    expect(result.content[0].text).toContain("No matches");
  });
});
