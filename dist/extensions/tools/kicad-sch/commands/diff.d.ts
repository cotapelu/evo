import { Type } from "typebox";
export declare const schema: Type.TObject<{
    file1: Type.TString;
    file2: Type.TString;
    output: Type.TOptional<Type.TString>;
}>;
export declare function execute(args: any, cwd: string, signal?: AbortSignal, ctx?: any): Promise<{
    stdout: any;
    stderr: any;
    code: any;
}>;
declare const _default: {
    schema: Type.TObject<{
        file1: Type.TString;
        file2: Type.TString;
        output: Type.TOptional<Type.TString>;
    }>;
    execute: typeof execute;
};
export default _default;
//# sourceMappingURL=diff.d.ts.map