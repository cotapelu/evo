/**
 * Echo Action
 *
 * Echoes back a message. Simple demonstration.
 */
export const echoAction = {
    execute: async (params) => {
        if (!params.message) {
            throw new Error("Missing required parameter 'message' for echo action");
        }
        const message = params.message;
        return {
            content: [{ type: "text", text: `Echo: ${message}` }],
            details: message,
        };
    },
    getParameters: () => ({
        type: "object",
        properties: {
            message: {
                type: "string",
                description: "Message to echo back",
            },
        },
        required: ["message"],
    }),
};
//# sourceMappingURL=echo-action.js.map