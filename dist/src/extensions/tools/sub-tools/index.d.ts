#!/usr/bin/env node
/**
 * Sub-Tools Index
 * Minimal tools that provide value over raw bash.
 *
 * Philosophy:
 * - Keep only tools with structured schemas and cleaner error handling
 * - Everything else: use built-in 'bash' tool
 *
 * Current tools:
 * - computer-use: ls, find, grep, read (file operations)
 * - http: Web requests (better than curl flags)
 */
export { lsSchema, executeLs } from "./computer-use.js";
export { findSchema, executeFind } from "./computer-use.js";
export { grepSchema, executeGrep } from "./computer-use.js";
export { readSchema, executeRead } from "./computer-use.js";
export { httpSchema, executeHttp } from "./http.js";
//# sourceMappingURL=index.d.ts.map