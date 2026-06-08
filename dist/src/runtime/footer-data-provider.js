/**
 * FooterDataProvider - Provides data for the footer component
 * Minimal implementation for Evo Agent
 */
export class FooterDataProvider {
    cwd;
    branch = null;
    listeners = new Set();
    extensionStatuses = new Map();
    availableProviderCount = 0;
    constructor(cwd) {
        this.cwd = cwd;
    }
    getGitBranch() {
        return this.branch;
    }
    onBranchChange(cb) {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }
    setCwd(cwd) {
        this.cwd = cwd;
    }
    dispose() {
        this.listeners.clear();
    }
    getExtensionStatuses() {
        return new Map(this.extensionStatuses);
    }
    getAvailableProviderCount() {
        return this.availableProviderCount;
    }
    setExtensionStatus(extension, status) {
        if (status === undefined) {
            this.extensionStatuses.delete(extension);
        }
        else {
            this.extensionStatuses.set(extension, status);
        }
    }
    clearExtensionStatuses() {
        this.extensionStatuses.clear();
    }
    setAvailableProviderCount(count) {
        this.availableProviderCount = count;
    }
}
//# sourceMappingURL=footer-data-provider.js.map