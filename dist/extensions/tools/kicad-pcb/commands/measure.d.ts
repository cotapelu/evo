import { Type } from "typebox";
export declare const schema: Type.TObject<{
    input: Type.TString;
    point1: Type.TString;
    point2: Type.TString;
}>;
export declare function execute(args: any, cwd: string, signal?: AbortSignal, ctx?: any): Promise<{
    stdout: any;
    stderr: any;
    code: any;
}>;
declare const _default: {
    schema: Type.TObject<{
        input: Type.TString;
        point1: Type.TString;
        point2: Type.TString;
    }>;
    execute: typeof execute;
};
export default _default;
//# sourceMappingURL=measure.d.ts.map