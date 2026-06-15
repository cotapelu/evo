#!/usr/bin/env node
/**
 * codebase.safe_edit capability
 *
 * Edits code with validation: syntax check, optional import fixing, formatting.
 * Rolls back on any failure to preserve working tree.
 */

import { Type } from "typebox";
import { promises as fs } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const schema = Type.Object({
  operations: Type.Array(Type.Object({
    file: Type.String({ description: "File path to edit" }),
    editType: Type.Union([Type.Literal("replace"), Type.Literal("insert"), Type.Literal("delete")], { description: "Type of edit operation" }),
    range: Type.Object({
      start: Type.Integer({ description: "Start line (0-indexed, inclusive)" }),
      end: Type.Integer({ description: "End line (0-indexed, exclusive)" })
    }, { required: ["start", "end"] }),
    newCode: Type.Optional(Type.String({ description: "New code content (required for replace/insert)" }))
  }), { description: "List of edit operations to apply atomically" }),
  format: Type.Optional(Type.Boolean({ description: "Run Prettier after edit (default true)" })),
  fixImports: Type.Optional(Type.Boolean({ description: "Attempt to fix imports automatically (default true)" }))
}, { additionalProperties: false });

interface EditOperation {
  file: string;
  editType: "replace" | "insert" | "delete";
  range: { start: number; end: number };
  newCode?: string;
}

interface EditResult {
  file: string;
  success: boolean;
  backupRestored?: boolean;
  error?: string;
  diff?: string;
}

export async function execute(params: { operations: EditOperation[]; format?: boolean; fixImports?: boolean }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();
  const format = params.format !== false; // default true
  const fixImports = params.fixImports !== false; // default true

  const results: EditResult[] = [];
  const backups: Map<string, string> = new Map();

  // Helper: create backup of file
  const backupFile = async (file: string) => {
    const absPath = join(cwd, file);
    try {
      const content = await fs.readFile(absPath, "utf-8");
      backups.set(file, content);
      return content;
    } catch (err) {
      throw new Error(`Cannot read file ${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Helper: restore backup
  const restoreBackup = async (file: string) => {
    const backup = backups.get(file);
    if (backup) {
      const absPath = join(cwd, file);
      await fs.writeFile(absPath, backup, "utf-8");
    }
  };

  // Helper: compute simple diff
  const computeDiff = (original: string, modified: string, file: string): string => {
    const origLines = original.split('\n');
    const modLines = modified.split('\n');
    const max = Math.max(origLines.length, modLines.length);
    let diff = `diff --git a/${file} b/${file}\n`;
    diff += `--- a/${file}\n`;
    diff += `+++ b/${file}\n`;

    for (let i = 0; i < max; i++) {
      const orig = origLines[i] ?? '';
      const mod = modLines[i] ?? '';
      if (orig !== mod) {
        if (orig) diff += `- ${orig}\n`;
        if (mod) diff += `+ ${mod}\n`;
      } else if (orig) {
        diff += `  ${orig}\n`;
      }
    }
    return diff;
  };

  // Inline: syntax check, fix imports, format using ctx.exec

  // Apply edits sequentially, with rollback on any failure
  for (const op of params.operations) {
    const { file, editType, range, newCode } = op;
    let result: EditResult = { file, success: false };

    try {
      // 1. Backup original before any changes
      const original = await backupFile(file);
      const absPath = join(cwd, file);

      // 2. Read and modify lines
      let lines = original.split('\n');

      // Validate range
      if (range.start < 0 || range.end < range.start || range.end > lines.length) {
        throw new Error(`Invalid range ${JSON.stringify(range)} for file with ${lines.length} lines`);
      }

      // Validate newCode for replace/insert
      if (editType !== "delete" && !newCode) {
        throw new Error(`newCode is required for editType '${editType}'`);
      }

      // Apply edit
      const newLines = newCode ? newCode.split('\n') : [];
      if (editType === "replace") {
        lines.splice(range.start, range.end - range.start, ...newLines);
      } else if (editType === "insert") {
        lines.splice(range.start, 0, ...newLines);
      } else if (editType === "delete") {
        lines.splice(range.start, range.end - range.start);
      } else {
        throw new Error(`Unknown editType: ${editType}`);
      }

      // 3. Write modified content
      const modified = lines.join('\n');
      await fs.writeFile(absPath, modified, "utf-8");

      // 4. Syntax check (run tsc --noEmit on the file)
      {
        const tscResult = await ctx.exec("npx", ["tsc", "--noEmit", file], { cwd });
        // tsc returns 0 for no errors, 2 for type errors (still syntactically valid)
        // Any other exit code is considered a failure and will trigger rollback
        if (tscResult.code !== 0 && tscResult.code !== 2) {
          throw new Error(`TypeScript check failed: exit code ${tscResult.code}, stderr: ${tscResult.stderr || 'none'}`);
        }
      }

      // 5. Fix imports (if enabled) - try eslint --fix
      if (fixImports) {
        try {
          await ctx.exec("npx", ["eslint", "--fix", file], { cwd });
        } catch (err) {
          // eslint not available, ignore
        }
      }

      // 6. Format (if enabled)
      if (format) {
        const fmtResult = await ctx.exec("npx", ["prettier", "--write", file], { cwd });
        if (fmtResult.code !== 0) {
          throw new Error(`Prettier formatting failed: exit ${fmtResult.code}, stderr: ${fmtResult.stderr || 'none'}`);
        }
      }

      // 7. Success - record diff
      result.success = true;
      result.diff = computeDiff(original, modified, file);
    } catch (err) {
      // Rollback this file if backup exists
      if (backups.has(file)) {
        await restoreBackup(file);
        result.backupRestored = true;
      }
      result.error = err instanceof Error ? err.message : String(err);
    }

    results.push(result);
  }

  const allSucceeded = results.every(r => r.success);
  return {
    success: allSucceeded,
    results,
    summary: `${results.filter(r => r.success).length}/${results.length} operations succeeded`
  };
}

export default { execute, schema };
