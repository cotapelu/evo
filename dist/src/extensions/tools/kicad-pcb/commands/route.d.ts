import { Type } from "typebox";
export declare const schema: Type.TObject<{
    input: Type.TString;
    start: Type.TString;
    end: Type.TString;
    layer: Type.TOptional<Type.TString>;
}>;
export declare function execute(args: any, cwd: string, signal?: AbortSignal, ctx?: any): Promise<{
    stdout: any;
    stderr: any;
    code: any;
}>;
declare const _default: {
    schema: Type.TObject<{
        input: Type.TString;
        start: Type.TString;
        end: Type.TString;
        layer: Type.TOptional<Type.TString>;
    }>;
    execute: typeof execute;
};
export default _default;
//# sourceMappingURL=route.d.ts.map