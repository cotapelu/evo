/**
 * System Info Action
 *
 * Returns system information (OS, architecture, Node version, etc).
 */
export declare const systemInfoAction: {
    execute: () => Promise<{
        content: {
            type: string;
            text: string;
        }[];
        details: {
            platform: NodeJS.Platform;
            arch: string;
            osRelease: string;
            nodeVersion: string;
            uptime: number;
            totalMemoryMB: number;
            freeMemoryMB: number;
            cpuCores: number;
            cpuModel: string;
        };
    }>;
    getParameters: () => {
        type: string;
        properties: {};
    };
};
//# sourceMappingURL=system-info-action.d.ts.map