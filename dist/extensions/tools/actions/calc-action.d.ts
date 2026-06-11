/**
 * Calc Action
 *
 * Evaluates a basic math expression safely.
 */
export declare const calcAction: {
    execute: (params: {
        expression: string;
    }) => Promise<{
        content: {
            type: string;
            text: string;
        }[];
        details: {
            expression: string;
            result: number;
        };
    }>;
    getParameters: () => {
        type: string;
        properties: {
            expression: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
//# sourceMappingURL=calc-action.d.ts.map