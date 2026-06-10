#!/usr/bin/env node
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
export interface CachedSessionStats {
    sessionId: string;
    messageCount: number;
    turnCount: number;
    compactionCount: number;
    branchCount: number;
    lastActivity: Date;
    lastEvent: string;
    totalEntries: number;
}
export declare function installSessionStatsCache(api: ExtensionAPI): void;
export declare function getCacheForContext(ctx: ExtensionContext): CachedSessionStats | null;
//# sourceMappingURL=session-stats-cache.d.ts.map