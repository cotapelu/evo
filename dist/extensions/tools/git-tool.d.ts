#!/usr/bin/env node
/**
 * Git Tool
 *
 * Wraps common Git operations.
 * Actions:
 * - status: git status --porcelain
 * - diff: git diff [path] (if no path, diff HEAD)
 * - commit: git commit -m "<message>" (requires message)
 * - add: git add <files...> (requires files array)
 * - push: git push [remote] [branch] (defaults: origin HEAD)
 * - pull: git pull [remote] [branch] (defaults: origin HEAD)
 * - log: git log --oneline -n <count> (default 10)
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export declare function registerGitTool(api: ExtensionAPI): void;
//# sourceMappingURL=git-tool.d.ts.map