/**
 * Date Action
 *
 * Returns current date/time in ISO and locale formats.
 */
export declare const dateAction: {
    execute: () => Promise<{
        content: {
            type: string;
            text: string;
        }[];
        details: {
            iso: string;
            timestamp: number;
            locale: string;
        };
    }>;
    getParameters: () => {
        type: string;
        properties: {};
    };
};
//# sourceMappingURL=date-action.d.ts.map