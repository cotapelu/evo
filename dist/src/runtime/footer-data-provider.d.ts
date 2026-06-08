/**
 * FooterDataProvider - Provides data for the footer component
 * Minimal implementation for Evo Agent
 */
export type ReadonlyFooterDataProvider = Pick<FooterDataProvider, 'getGitBranch' | 'onBranchChange' | 'getExtensionStatuses' | 'getAvailableProviderCount'>;
export declare class FooterDataProvider {
    private cwd;
    private branch;
    private listeners;
    private extensionStatuses;
    private availableProviderCount;
    constructor(cwd: string);
    getGitBranch(): string | null;
    onBranchChange(cb: () => void): () => void;
    setCwd(cwd: string): void;
    dispose(): void;
    getExtensionStatuses(): Map<string, string>;
    getAvailableProviderCount(): number;
    setExtensionStatus(extension: string, status: string | undefined): void;
    clearExtensionStatuses(): void;
    setAvailableProviderCount(count: number): void;
}
//# sourceMappingURL=footer-data-provider.d.ts.map