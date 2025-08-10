import { Action, EventObject, Guard, MachineConfig, assign, createMachine, interpret } from "../core/StateMachine.js";

export type FormValues = Record<string, unknown>;
export type FormErrors = Record<string, string | undefined>;

export type FormContext = {
  values: FormValues;
  errors: FormErrors;
  touched: Record<string, boolean>;
  submitResult?: unknown;
  submitError?: unknown;
};

export type ChangeEvent = EventObject & { type: "CHANGE"; name: string; value: unknown };
export type SubmitEvent = EventObject & { type: "SUBMIT" };
export type RetryEvent = EventObject & { type: "RETRY" };

export type FormEvent = ChangeEvent | SubmitEvent | RetryEvent | EventObject;

export type Validator = (values: FormValues) => FormErrors;
export type SubmitHandler = (values: FormValues) => Promise<unknown>;

export type CreateFormMachineOptions = {
  id?: string;
  initialValues: FormValues;
  validate: Validator;
  submit: SubmitHandler;
};

const setField: Action<FormContext, FormEvent> = assign((ctx, evt) => {
  if (evt.type !== "CHANGE") return ctx;
  const e = evt as ChangeEvent;
  return {
    ...ctx,
    values: { ...ctx.values, [e.name]: e.value },
    touched: { ...ctx.touched, [e.name]: true },
    errors: { ...ctx.errors, [e.name]: undefined },
  };
});

export function createFormMachine({ id = "form", initialValues, validate, submit }: CreateFormMachineOptions) {
  const validateAction: Action<FormContext, FormEvent> = assign((ctx) => {
    const errors = validate(ctx.values);
    return { ...ctx, errors };
  });

  const isValid: Guard<FormContext, FormEvent> = (ctx) => {
    const errors = validate(ctx.values);
    return Object.values(errors).every((e) => !e);
  };

  const machineConfig: MachineConfig<FormContext, FormEvent> = {
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
                const e = _e as unknown as { data: unknown };
                return { ...ctx, submitResult: e.data };
              }),
            ],
          },
          onError: {
            target: "failure",
            actions: [
              assign((ctx, _e) => {
                const e = _e as unknown as { error: unknown };
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

  const machine = createMachine<FormContext, FormEvent>(machineConfig);
  return interpret(machine);
}


