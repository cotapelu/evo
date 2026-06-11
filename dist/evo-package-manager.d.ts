#!/usr/bin/env node
/**
 * Evo Package Manager (Simplified)
 *
 * Minimal implementation for install/remove/list and resource resolution.
 * Uses .evo directory.
 */
interface PathMetadata {
    source: string;
    scope: "user" | "project";
    origin: "package";
    baseDir?: string;
}
export interface PackageFilter {
    extensions?: string[];
    skills?: string[];
    prompts?: string[];
    themes?: string[];
}
interface ResolvedResource {
    path: string;
    enabled: boolean;
    metadata: PathMetadata;
}
interface ResolvedPaths {
    extensions: ResolvedResource[];
    skills: ResolvedResource[];
    prompts: ResolvedResource[];
    themes: ResolvedResource[];
}
interface ProgressEvent {
    type: "start" | "progress" | "complete" | "error";
    action: "install" | "remove" | "update" | "clone" | "pull";
    source: string;
    message?: string;
}
type ProgressCallback = (event: ProgressEvent) => void;
export declare class EvoPackageManager {
    private cwd;
    private agentDir;
    private progressCallback;
    constructor(options: {
        cwd: string;
        agentDir: string;
    });
    setProgressCallback(callback: ProgressCallback | undefined): void;
    private emitProgress;
    private withProgress;
    private getProjectSettingsPath;
    private getGlobalSettingsPath;
    private loadSettings;
    private saveSettings;
    addSourceToSettings(source: string | {
        source: string;
        filter?: PackageFilter;
    }, options?: {
        local?: boolean;
    }): boolean;
    removeSourceFromSettings(source: string, options?: {
        local?: boolean;
    }): boolean;
    getInstalledPath(source: string, scope: "user" | "project"): string | undefined;
    install(source: string, options?: {
        local?: boolean;
        dryRun?: boolean;
    }): Promise<void>;
    installAndPersist(source: string, options?: {
        local?: boolean;
        dryRun?: boolean;
        filter?: PackageFilter;
    }): Promise<void>;
    remove(source: string, options?: {
        local?: boolean;
        dryRun?: boolean;
    }): Promise<void>;
    removeAndPersist(source: string, options?: {
        local?: boolean;
        dryRun?: boolean;
    }): Promise<boolean>;
    private getConfiguredEntries;
    listConfiguredPackages(): Array<{
        source: string;
        scope: "user" | "project";
        installedPath?: string;
        filtered: boolean;
    }>;
    resolveExtensionSources(sources: string[], options?: {
        local?: boolean;
        temporary?: boolean;
    }): Promise<ResolvedPaths>;
    resolve(_onMissing?: (source: string) => Promise<any>): Promise<ResolvedPaths>;
    update(source?: string, options?: {
        local?: boolean;
        dryRun?: boolean;
    }): Promise<void>;
    private updateNpm;
    private updateGit;
    private getInstalledNpmVersion;
    private getLatestNpmVersion;
    private runCommandCapture;
    private parseSource;
    private validateParsed;
    private getNpmInstallPath;
    private getGitInstallRoot;
    private getGitInstallPath;
    private installGit;
    private uninstallGit;
    private pruneEmptyParents;
    private installNpm;
    private uninstallNpm;
    private getProjectNpmRoot;
    private getGlobalNpmRoot;
    private ensureNpmProject;
    private runNpmCommand;
    private withRetry;
    private runCommand;
    private collectPackageResources;
}
export {};
//# sourceMappingURL=evo-package-manager.d.ts.map