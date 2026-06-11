/**
 * Command line argument parsing utilities for slash commands.
 * Reduces duplication across command handlers.
 */
export interface ParsedArgs {
    action: string;
    args: string[];
}
/**
 * Split command input into action and arguments.
 * Trims whitespace and splits on any whitespace.
 * @param input Raw command string (everything after the command name)
 * @returns Parsed action and argument array
 */
export declare function parseArgs(input: string): ParsedArgs;
/**
 * Validate that enough arguments are present.
 * Throws an Error with a usage message if validation fails.
 * @param parsed Parsed arguments
 * @param minArgs Minimum number of required arguments (excluding action)
 * @param usage Optional usage string to show on error
 */
export declare function requireArgs(parsed: ParsedArgs, minArgs: number, usage?: string): void;
/**
 * Get a specific argument by index, with optional default.
 */
export declare function getArg(parsed: ParsedArgs, index: number, defaultValue?: string): string | undefined;
//# sourceMappingURL=command-args.d.ts.map