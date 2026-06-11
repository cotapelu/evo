#!/usr/bin/env node
/**
 * File System Operations
 * Convenience wrappers for common file operations.
 *
 * These provide typed schemas and cleaner error handling vs raw bash.
 * For general command execution, use the built-in 'bash' tool.
 */
import { Type } from "typebox";
export declare const lsSchema: Type.TObject<{
    path: Type.TOptional<Type.TString>;
    recursive: Type.TOptional<Type.TBoolean>;
    all: Type.TOptional<Type.TBoolean>;
}>;
export declare const findSchema: Type.TObject<{
    path: Type.TOptional<Type.TString>;
    pattern: Type.TString;
    maxDepth: Type.TOptional<Type.TNumber>;
}>;
export declare const grepSchema: Type.TObject<{
    pattern: Type.TString;
    path: Type.TOptional<Type.TString>;
    include: Type.TOptional<Type.TString>;
    exclude: Type.TOptional<Type.TString>;
    ignoreCase: Type.TOptional<Type.TBoolean>;
}>;
export declare const readSchema: Type.TObject<{
    path: Type.TString;
    offset: Type.TOptional<Type.TNumber>;
    limit: Type.TOptional<Type.TNumber>;
}>;
/**
 * List directory contents (ls)
 */
export declare function executeLs(args: any, cwd: string, signal?: AbortSignal, ctx?: any): Promise<{
    readonly content: readonly [{
        readonly type: "text";
        readonly text: any;
    }];
    readonly details: {
        readonly exitCode: any;
        readonly killed: any;
        readonly path: string;
    };
    readonly isError: boolean;
} | {
    readonly content: readonly [{
        readonly type: "text";
        readonly text: `ls error: ${any}`;
    }];
    readonly details: undefined;
    readonly isError: true;
}>;
/**
 * Find files by pattern (find)
 */
export declare function executeFind(args: any, cwd: string, signal?: AbortSignal, ctx?: any): Promise<{
    readonly content: readonly [{
        readonly type: "text";
        readonly text: any;
    }];
    readonly details: {
        readonly exitCode: any;
        readonly killed: any;
        readonly pattern: string;
        readonly path: string;
    };
    readonly isError: boolean;
} | {
    readonly content: readonly [{
        readonly type: "text";
        readonly text: `find error: ${any}`;
    }];
    readonly details: undefined;
    readonly isError: true;
}>;
/**
 * Search file contents (grep)
 */
export declare function executeGrep(args: any, cwd: string, signal?: AbortSignal, ctx?: any): Promise<{
    readonly content: readonly [{
        readonly type: "text";
        readonly text: any;
    }];
    readonly details: {
        readonly exitCode: any;
        readonly killed: any;
        readonly pattern: string;
        readonly path: string;
    };
    readonly isError: boolean;
} | {
    readonly content: readonly [{
        readonly type: "text";
        readonly text: `grep error: ${any}`;
    }];
    readonly details: undefined;
    readonly isError: true;
}>;
/**
 * Read file contents with optional offset/limit
 */
export declare function executeRead(args: any, cwd: string, signal?: AbortSignal, ctx?: any): Promise<{
    readonly content: readonly [{
        readonly type: "text";
        readonly text: any;
    }];
    readonly details: {
        readonly exitCode: any;
        readonly killed: any;
        readonly path: string;
        readonly offset: number | undefined;
        readonly limit: number | undefined;
    };
    readonly isError: boolean;
} | {
    readonly content: readonly [{
        readonly type: "text";
        readonly text: `read error: ${any}`;
    }];
    readonly details: undefined;
    readonly isError: true;
}>;
//# sourceMappingURL=computer-use.d.ts.map