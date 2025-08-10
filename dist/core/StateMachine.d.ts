export type EventObject = {
    type: string;
    [key: string]: unknown;
};
export type Action<Context, Event extends EventObject> = (context: Context, event: Event, api: ActionAPI<Context, Event>) => void;
export type Guard<Context, Event extends EventObject> = (context: Context, event: Event) => boolean;
export type TransitionConfig<Context, Event extends EventObject> = {
    target?: string;
    actions?: Array<Action<Context, Event>>;
    guard?: Guard<Context, Event>;
};
export type StateConfig<Context, Event extends EventObject> = {
    on?: Record<string, TransitionConfig<Context, Event> | Array<TransitionConfig<Context, Event>>>;
    entry?: Array<Action<Context, Event>>;
    exit?: Array<Action<Context, Event>>;
    invoke?: InvokeConfig<Context, Event>;
    tags?: Array<string>;
};
export type InvokeSrc<Context, Event extends EventObject, Data = unknown> = (context: Context, event: Event, api: InvokeAPI<Context, Event>) => Promise<Data> | {
    promise: Promise<Data>;
    cancel?: () => void;
};
export type InvokeConfig<Context, Event extends EventObject> = {
    src: InvokeSrc<Context, Event>;
    onDone?: TransitionConfig<Context, Event & {
        data: unknown;
    }>;
    onError?: TransitionConfig<Context, Event & {
        error: unknown;
    }>;
    autoStart?: boolean;
};
export type MachineConfig<Context, Event extends EventObject> = {
    id?: string;
    context: Context;
    initial: string;
    states: Record<string, StateConfig<Context, Event>>;
};
export type StateSnapshot<Context> = {
    value: string;
    context: Context;
    changed: boolean;
    tags: Array<string>;
};
export type Listener<Context> = (state: StateSnapshot<Context>) => void;
export type Service<Context, Event extends EventObject> = {
    start: (initialContext?: Partial<Context>) => Service<Context, Event>;
    stop: () => void;
    send: (event: Event) => void;
    subscribe: (listener: Listener<Context>) => () => void;
    getState: () => StateSnapshot<Context>;
};
export type ActionAPI<Context, Event extends EventObject> = {
    setContext: (updater: Context | ((prev: Context) => Context)) => void;
    send: (event: Event) => void;
};
export type InvokeAPI<Context, Event extends EventObject> = {
    readonly state: StateSnapshot<Context>;
    send: (event: Event) => void;
    startInvoke: () => void;
    cancelInvoke: () => void;
};
export declare function createMachine<Context, Event extends EventObject>(config: MachineConfig<Context, Event>): {
    config: MachineConfig<Context, Event>;
};
export declare function interpret<Context, Event extends EventObject>(machine: ReturnType<typeof createMachine<Context, Event>>): Service<Context, Event>;
export declare function assign<Context, Event extends EventObject>(updater: (context: Context, event: Event) => Context): Action<Context, Event>;
