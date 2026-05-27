declare module './command-module' {
  import { Schema } from 'typebox';
  export const schema: any;
  export function execute(args: any, cwd: string, signal?: AbortSignal, ctx?: any): Promise<{ stdout: string; stderr: string; code: number }>;
  export default { schema, execute };
}
