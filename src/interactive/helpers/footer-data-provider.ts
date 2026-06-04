/**
 * FooterDataProvider - Provides data for the footer component
 * Minimal implementation for Evo Agent
 */

export type ReadonlyFooterDataProvider = Pick<FooterDataProvider, 'getGitBranch' | 'onBranchChange' | 'getExtensionStatuses' | 'getAvailableProviderCount'>;

export class FooterDataProvider {
	private cwd: string;
	private branch: string | null = null;
	private listeners = new Set<() => void>();
	private extensionStatuses = new Map<string, string>();
	private availableProviderCount = 0;

	constructor(cwd: string) {
		this.cwd = cwd;
	}

	getGitBranch(): string | null {
		return this.branch;
	}

	onBranchChange(cb: () => void): () => void {
		this.listeners.add(cb);
		return () => this.listeners.delete(cb);
	}

	setCwd(cwd: string): void {
		this.cwd = cwd;
	}

	dispose(): void {
		this.listeners.clear();
	}

	getExtensionStatuses(): Map<string, string> {
		return new Map(this.extensionStatuses);
	}

	getAvailableProviderCount(): number {
		return this.availableProviderCount;
	}

	setExtensionStatus(extension: string, status: string | undefined): void {
		if (status === undefined) {
			this.extensionStatuses.delete(extension);
		} else {
			this.extensionStatuses.set(extension, status);
		}
	}

	clearExtensionStatuses(): void {
		this.extensionStatuses.clear();
	}

	setAvailableProviderCount(count: number): void {
		this.availableProviderCount = count;
	}
}
