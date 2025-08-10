import { assign, createMachine, interpret } from "../core/StateMachine.js";
const setField = assign((ctx, evt) => {
    if (evt.type !== "CHANGE")
        return ctx;
    const e = evt;
    return {
        ...ctx,
        values: { ...ctx.values, [e.name]: e.value },
        touched: { ...ctx.touched, [e.name]: true },
        errors: { ...ctx.errors, [e.name]: undefined },
    };
});
export function createFormMachine({ id = "form", initialValues, validate, submit }) {
    const validateAction = assign((ctx) => {
        const errors = validate(ctx.values);
        return { ...ctx, errors };
    });
    const isValid = (ctx) => {
        const errors = validate(ctx.values);
        return Object.values(errors).every((e) => !e);
    };
    const machineConfig = {
        id,
        context: {
            values: { ...initialValues },
            errors: {},
            touched: {},
            submitResult: undefined,
            submitError: undefined,
        },
        initial: "idle",
        states: {
            idle: {
                on: {
                    CHANGE: [{ target: "dirty", actions: [setField] }],
                    SUBMIT: [
                        { target: "submitting", actions: [validateAction], guard: isValid },
                        { target: "invalid", actions: [validateAction] },
                    ],
                },
            },
            dirty: {
                on: {
                    CHANGE: [{ actions: [setField] }],
                    SUBMIT: [
                        { target: "submitting", actions: [validateAction], guard: isValid },
                        { target: "invalid", actions: [validateAction] },
                    ],
                },
            },
            invalid: {
                on: {
                    CHANGE: [{ target: "dirty", actions: [setField] }],
                    SUBMIT: [
                        { target: "submitting", actions: [validateAction], guard: isValid },
                        { actions: [validateAction] },
                    ],
                },
                tags: ["error"],
            },
            submitting: {
                entry: [
                    assign((ctx) => ({ ...ctx, submitResult: undefined, submitError: undefined })),
                ],
                invoke: {
                    src: (ctx) => submit(ctx.values),
                    onDone: {
                        target: "success",
                        actions: [
                            assign((ctx, _e) => {
                                const e = _e;
                                return { ...ctx, submitResult: e.data };
                            }),
                        ],
                    },
                    onError: {
                        target: "failure",
                        actions: [
                            assign((ctx, _e) => {
                                const e = _e;
                                return { ...ctx, submitError: e.error };
                            }),
                        ],
                    },
                },
                on: {
                    CHANGE: [{ actions: [setField] }],
                },
                tags: ["loading"],
            },
            success: {
                tags: ["success"],
                on: {
                    CHANGE: [{ target: "dirty", actions: [setField] }],
                },
            },
            failure: {
                tags: ["error"],
                on: {
                    RETRY: [{ target: "submitting" }],
                    CHANGE: [{ target: "dirty", actions: [setField] }],
                },
            },
        },
    };
    const machine = createMachine(machineConfig);
    return interpret(machine);
}
//# sourceMappingURL=FormMachine.js.map