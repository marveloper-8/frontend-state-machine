import { EventObject } from "../core/StateMachine.js";
export type FormValues = Record<string, unknown>;
export type FormErrors = Record<string, string | undefined>;
export type FormContext = {
    values: FormValues;
    errors: FormErrors;
    touched: Record<string, boolean>;
    submitResult?: unknown;
    submitError?: unknown;
};
export type ChangeEvent = EventObject & {
    type: "CHANGE";
    name: string;
    value: unknown;
};
export type SubmitEvent = EventObject & {
    type: "SUBMIT";
};
export type RetryEvent = EventObject & {
    type: "RETRY";
};
export type FormEvent = ChangeEvent | SubmitEvent | RetryEvent | EventObject;
export type Validator = (values: FormValues) => FormErrors;
export type SubmitHandler = (values: FormValues) => Promise<unknown>;
export type CreateFormMachineOptions = {
    id?: string;
    initialValues: FormValues;
    validate: Validator;
    submit: SubmitHandler;
};
export declare function createFormMachine({ id, initialValues, validate, submit }: CreateFormMachineOptions): import("../core/StateMachine.js").Service<FormContext, FormEvent>;
