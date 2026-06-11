/**
 * Echo Action
 *
 * Echoes back a message. Simple demonstration.
 */
export declare const echoAction: {
    execute: (params: {
        message?: string;
    }) => Promise<{
        content: {
            type: string;
            text: string;
        }[];
        details: string;
    }>;
    getParameters: () => {
        type: string;
        properties: {
            message: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
//# sourceMappingURL=echo-action.d.ts.map