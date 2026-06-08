/**
 * Random Action
 *
 * Generates a random integer within an optional range.
 */
export declare const randomAction: {
    execute: (params: {
        min?: number;
        max?: number;
    }) => Promise<{
        content: {
            type: string;
            text: string;
        }[];
        details: {
            value: number;
            min: number;
            max: number;
        };
    }>;
    getParameters: () => {
        type: string;
        properties: {
            min: {
                type: string;
                description: string;
            };
            max: {
                type: string;
                description: string;
            };
        };
        required: never[];
    };
};
//# sourceMappingURL=random-action.d.ts.map