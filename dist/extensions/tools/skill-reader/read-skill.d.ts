import { Type } from "typebox";
/**
 * Schema for read_skill command
 */
export declare const schema: Type.TObject<{
    skill: Type.TOptional<Type.TString>;
}>;
/**
 * Execute load_skill command
 *
 * Behavior:
 * - No args / empty skill → list all skill names
 * - With skill name → read .md file and return its content
 *
 * IMPORTANT: This tool only RETRIEVES skill content for LLM inspection.
 * It does NOT register skills with Pi or modify system state.
 */
export declare function executeLoadSkill(args: any, cwd: string, signal?: AbortSignal, ctx?: any): Promise<{
    stdout: string;
    stderr: string;
    code: number;
}>;
//# sourceMappingURL=read-skill.d.ts.map