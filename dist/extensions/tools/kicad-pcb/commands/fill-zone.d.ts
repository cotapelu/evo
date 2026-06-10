import { Type } from "typebox";
export declare const schema: Type.TObject<{
    input: Type.TString;
    zone_id: Type.TOptional<Type.TString>;
    all: Type.TOptional<Type.TBoolean>;
}>;
export declare function execute(args: any, cwd: string, signal?: AbortSignal, ctx?: any): Promise<{
    stdout: any;
    stderr: any;
    code: any;
}>;
declare const _default: {
    schema: Type.TObject<{
        input: Type.TString;
        zone_id: Type.TOptional<Type.TString>;
        all: Type.TOptional<Type.TBoolean>;
    }>;
    execute: typeof execute;
};
export default _default;
//# sourceMappingURL=fill-zone.d.ts.map