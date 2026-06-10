import { Type } from "typebox";
export declare const schema: Type.TObject<{
    input: Type.TString;
    reset: Type.TOptional<Type.TBoolean>;
}>;
export declare function execute(args: any, cwd: string, signal?: AbortSignal, ctx?: any): Promise<{
    stdout: any;
    stderr: any;
    code: any;
}>;
declare const _default: {
    schema: Type.TObject<{
        input: Type.TString;
        reset: Type.TOptional<Type.TBoolean>;
    }>;
    execute: typeof execute;
};
export default _default;
//# sourceMappingURL=annotate.d.ts.map