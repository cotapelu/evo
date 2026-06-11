/**
 * UUID Action
 *
 * Generates a random UUID v4.
 */
export declare const uuidAction: {
    execute: () => Promise<{
        content: {
            type: string;
            text: string;
        }[];
        details: {
            uuid: `${string}-${string}-${string}-${string}-${string}`;
        };
    }>;
    getParameters: () => {
        type: string;
        properties: {};
    };
};
//# sourceMappingURL=uuid-action.d.ts.map