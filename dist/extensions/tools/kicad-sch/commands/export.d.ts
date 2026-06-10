import { Type } from "typebox";
export declare const schema: Type.TObject<{
    input: Type.TString;
    output: Type.TOptional<Type.TString>;
    format: Type.TOptional<Type.TString>;
}>;
export declare function execute(args: any, cwd: string, signal?: AbortSignal, ctx?: any): Promise<{
    stdout: any;
    stderr: any;
    code: any;
}>;
declare const _default: {
    schema: Type.TObject<{
        input: Type.TString;
        output: Type.TOptional<Type.TString>;
        format: Type.TOptional<Type.TString>;
    }>;
    execute: typeof execute;
};
export default _default;
//# sourceMappingURL=export.d.ts.map