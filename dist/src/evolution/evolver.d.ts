/**
 * Evolver - Safe Self-Modification System
 *
 * Applies learned patterns to improve codebase with full verification.
 */
import { PatternMatch } from './patterns.js';
interface EvolutionStep {
    id: string;
    file: string;
    patternId: string;
    original: string;
    modified: string;
    match: PatternMatch;
}
interface EvolutionResult {
    success: boolean;
    steps: EvolutionStep[];
    report: string;
    testResults?: string;
}
export declare class Evolver {
    private dryRun;
    private backupDir;
    constructor(dryRun?: boolean);
    run(targetDir?: string): Promise<EvolutionResult>;
    private countMatches;
    private generateSteps;
    private formatSteps;
    protected createBackup(steps: EvolutionStep[]): Promise<void>;
    private applyChanges;
    private restoreBackup;
    private listFiles;
    protected runTests(): Promise<{
        success: boolean;
        output: string;
    }>;
    protected commitChanges(steps: EvolutionStep[]): Promise<void>;
    private gitCmd;
}
export declare function evolve(options?: {
    dryRun?: boolean;
    target?: string;
}): Promise<number>;
export {};
//# sourceMappingURL=evolver.d.ts.map