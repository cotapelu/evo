type LogMeta = Record<string, unknown>;
export declare const logger: {
    debug: (message: string, meta?: LogMeta) => void;
    info: (message: string, meta?: LogMeta) => void;
    log: (message: string, meta?: LogMeta) => void;
    warn: (message: string, meta?: LogMeta) => void;
    error: (message: string, meta?: LogMeta) => void;
};
export {};
//# sourceMappingURL=logger.d.ts.map