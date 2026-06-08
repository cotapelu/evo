/**
 * Pattern Detection and Learning System
 *
 * Analyzes reference code examples and current codebase to identify
 * improvement opportunities based on coding patterns.
 */
import { FileCache } from './cache.js';
export interface Pattern {
    id: string;
    name: string;
    description: string;
    check: (code: string, filePath: string) => PatternMatch | null;
    fix: (code: string, filePath: string) => string;
    severity: 'info' | 'warning' | 'error';
}
export interface PatternMatch {
    patternId: string;
    line: number;
    column: number;
    message: string;
    suggestedFix: string;
}
export declare const patterns: Pattern[];
export declare function scanDirectory(dir: string, exts?: string[], options?: {
    exclude?: string[];
    cache?: FileCache;
}): Promise<Map<string, PatternMatch[]>>;
export declare function generateReport(results: Map<string, PatternMatch[]>): string;
//# sourceMappingURL=patterns.d.ts.map