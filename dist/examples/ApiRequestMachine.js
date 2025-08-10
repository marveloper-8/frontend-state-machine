import { assign, createMachine, interpret } from "../core/StateMachine.js";
export function createRequestMachine(requestFn) {
    const machineConfig = {
        context: {},
        initial: "idle",
        states: {
            idle: {
                on: {
                    FETCH: [
                        {
                            target: "loading",
                            actions: [
                                assign((ctx, evt) => ({
                                    ...ctx,
                                    requestInput: evt.input,
                                    error: undefined,
                                    response: undefined,
                                })),
                            ],
                        },
                    ],
                },
            },
            loading: {
                entry: [assign((ctx) => ({ ...ctx, startedAt: Date.now() }))],
                invoke: {
                    src: (ctx) => requestFn(ctx.requestInput),
                    onDone: {
                        target: "success",
                        actions: [
                            assign((ctx, _e) => {
                                const e = _e;
                                return { ...ctx, response: e.data, finishedAt: Date.now() };
                            }),
                        ],
                    },
                    onError: {
                        target: "failure",
                        actions: [
                            assign((ctx, _e) => {
                                const e = _e;
                                return { ...ctx, error: e.error, finishedAt: Date.now() };
                            }),
                        ],
                    },
                },
                on: {
                    CANCEL: [{ target: "idle" }],
                },
                tags: ["loading"],
            },
            success: {
                tags: ["success"],
                on: {
                    FETCH: [{ target: "loading" }],
                },
            },
            failure: {
                tags: ["error"],
                on: {
                    RETRY: [{ target: "loading" }],
                    FETCH: [{ target: "loading" }],
                },
            },
        },
    };
    const machine = createMachine(machineConfig);
    return interpret(machine);
}
//# sourceMappingURL=ApiRequestMachine.js.map