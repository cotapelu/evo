#!/usr/bin/env node
/**
 * HTTP Sub-Tool
 * Web requests with structured API (cleaner than raw curl)
 */
import { Type } from "typebox";
export declare const httpSchema: Type.TObject<{
    method: Type.TOptional<Type.TString>;
    url: Type.TString;
    headers: Type.TOptional<Type.TRecord<"^.*$", Type.TString>>;
    body: Type.TOptional<Type.TAny>;
    timeout: Type.TOptional<Type.TNumber>;
    insecure: Type.TOptional<Type.TBoolean>;
    user: Type.TOptional<Type.TString>;
    verbose: Type.TOptional<Type.TBoolean>;
}>;
export declare function executeHttp(args: any, cwd: string, signal?: AbortSignal, ctx?: any): Promise<{
    readonly content: readonly [{
        readonly type: "text";
        readonly text: any;
    }];
    readonly details: {
        readonly exitCode: any;
        readonly killed: any;
        readonly url: string;
        readonly method: string;
    };
    readonly isError: boolean;
} | {
    readonly content: readonly [{
        readonly type: "text";
        readonly text: `HTTP error: ${any}`;
    }];
    readonly details: undefined;
    readonly isError: true;
}>;
//# sourceMappingURL=http.d.ts.map