export type EventObject = { type: string; [key: string]: unknown };

export type Action<Context, Event extends EventObject> = (
  context: Context,
  event: Event,
  api: ActionAPI<Context, Event>
) => void;

export type Guard<Context, Event extends EventObject> = (
  context: Context,
  event: Event
) => boolean;

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

export type InvokeSrc<Context, Event extends EventObject, Data = unknown> = (
  context: Context,
  event: Event,
  api: InvokeAPI<Context, Event>
) => Promise<Data> | { promise: Promise<Data>; cancel?: () => void };

export type InvokeConfig<Context, Event extends EventObject> = {
  src: InvokeSrc<Context, Event>;
  onDone?: TransitionConfig<Context, Event & { data: unknown }>;
  onError?: TransitionConfig<Context, Event & { error: unknown }>;
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

export function createMachine<Context, Event extends EventObject>(
  config: MachineConfig<Context, Event>
) {
  return {
    config,
  };
}

type InternalTransition<Context, Event extends EventObject> = TransitionConfig<Context, Event>;

export function interpret<Context, Event extends EventObject>(
  machine: ReturnType<typeof createMachine<Context, Event>>
): Service<Context, Event> {
  const config = machine.config;
  let currentStateValue = config.initial;
  let currentContext: Context = deepClone(config.context);
  let running = false;
  let listeners: Array<Listener<Context>> = [];
  let processing = false;
  const queue: Array<Event> = [];
  let currentSnapshot: StateSnapshot<Context> = {
    value: currentStateValue,
    context: currentContext,
    changed: false,
    tags: config.states[currentStateValue]?.tags ?? [],
  };

  let activeInvokeToken: number | null = null;
  let activeInvokeCancel: (() => void) | null = null;
  let lastEventForInvoke: Event | null = null;

  const getStateSnapshot = (changed: boolean): StateSnapshot<Context> => {
    const tags = config.states[currentStateValue]?.tags ?? [];
    return { value: currentStateValue, context: currentContext, changed, tags };
  };

  const notify = (changed: boolean) => {
    // Only notify React subscribers when the snapshot actually changed.
    if (!changed) return;
    currentSnapshot = getStateSnapshot(true);
    for (const listener of listeners.slice()) listener(currentSnapshot);
  };

  const stopInvoke = () => {
    activeInvokeToken = null;
    if (activeInvokeCancel) {
      try {
        activeInvokeCancel();
      } catch {
        
      } finally {
        activeInvokeCancel = null;
      }
    }
  };

  const maybeStartInvoke = (enteredByEvent: Event | null) => {
    const stateNode = config.states[currentStateValue];
    if (!stateNode?.invoke) return;
    const { src, onDone, onError, autoStart = true } = stateNode.invoke;
    if (!autoStart) return;
    const token = Date.now() + Math.random();
    activeInvokeToken = token;
    lastEventForInvoke = enteredByEvent;

    const invokeApi: InvokeAPI<Context, Event> = {
      get state() {
        return getStateSnapshot(false);
      },
      send: (event) => service.send(event),
      startInvoke: () => {
        if (activeInvokeToken === token) {
        }
      },
      cancelInvoke: () => {
        if (activeInvokeToken === token) {
          stopInvoke();
        }
      },
    };

    const start = () => {
      const result = src(
        currentContext,
        (lastEventForInvoke ?? ({ type: "@@init" } as Event)),
        invokeApi
      );
      const { promise, cancel } = normalizeInvoke(result);
      activeInvokeCancel = typeof cancel === "function" ? cancel : null;
      promise
        .then((data) => {
          if (activeInvokeToken !== token) return;
          if (stateNode.invoke?.onDone) {
            applyTransition(stateNode.invoke.onDone as InternalTransition<Context, Event>, { ...(lastEventForInvoke as object), type: (lastEventForInvoke?.type ?? "done.invoke") } as Event, { data } as unknown as Event);
          } else {
          }
        })
        .catch((error) => {
          if (activeInvokeToken !== token) return;
          if (stateNode.invoke?.onError) {
            applyTransition(stateNode.invoke.onError as InternalTransition<Context, Event>, { ...(lastEventForInvoke as object), type: (lastEventForInvoke?.type ?? "error.invoke") } as Event, { error } as unknown as Event);
          } else {
          }
        })
        .finally(() => {
          if (activeInvokeToken === token) {
            stopInvoke();
          }
        });
    };

    start();
  };

  const runActions = (
    actions: Array<Action<Context, Event>> | undefined,
    event: Event
  ) => {
    if (!actions || actions.length === 0) return;
    let nextContext = currentContext;
    const api: ActionAPI<Context, Event> = {
      setContext: (updater) => {
        nextContext =
          typeof updater === "function"
            ? (updater as (prev: Context) => Context)(nextContext)
            : (updater as Context);
      },
      send: (evt) => service.send(evt),
    };
    for (const action of actions) action(nextContext, event, api);
    currentContext = nextContext;
  };

  const applyTransition = (
    transition: InternalTransition<Context, Event>,
    triggeringEvent: Event,
    supplemental?: Event
  ) => {
    const stateNode = config.states[currentStateValue];
    const target = transition.target;
    const isInternal = !target || target === currentStateValue;

    if (!isInternal) {
      runActions(stateNode.exit, triggeringEvent);
      stopInvoke();
    }

    runActions(transition.actions, supplemental ?? triggeringEvent);

    if (!isInternal) {
      currentStateValue = target as string;
      const nextStateNode = config.states[currentStateValue];
      runActions(nextStateNode.entry, triggeringEvent);
      maybeStartInvoke(triggeringEvent);
    }
  };

  const service: Service<Context, Event> = {
    start(initialContext?: Partial<Context>) {
      if (running) return service;
      running = true;
      currentContext = { ...deepClone(config.context), ...(initialContext ?? {}) } as Context;
      currentStateValue = config.initial;
      runActions(config.states[currentStateValue]?.entry, { type: "@@init" } as Event);
      maybeStartInvoke({ type: "@@init" } as Event);
      currentSnapshot = getStateSnapshot(true);
      notify(true);
      return service;
    },
    stop() {
      if (!running) return;
      stopInvoke();
      running = false;
      listeners = [];
    },
    send(event: Event) {
      if (!running) return;
      queue.push(event);
      if (processing) return;
      processing = true;
      try {
        while (queue.length) {
          const evt = queue.shift() as Event;
          const stateNode = config.states[currentStateValue];
          const maybeTransitions = stateNode.on?.[evt.type];
          if (!maybeTransitions) {
            notify(false);
            continue;
          }
          const transitions = Array.isArray(maybeTransitions)
            ? (maybeTransitions as Array<InternalTransition<Context, Event>>)
            : ([maybeTransitions] as Array<InternalTransition<Context, Event>>);
          const found = transitions.find((t) => (t.guard ? t.guard(currentContext, evt) : true));
          if (!found) {
            notify(false);
            continue;
          }
          const prev = getStateSnapshot(false);
          applyTransition(found, evt);
          const changed = prev.value !== currentStateValue || prev.context !== currentContext;
          notify(changed);
        }
      } finally {
        processing = false;
      }
    },
    subscribe(listener: Listener<Context>) {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter((l) => l !== listener);
      };
    },
    getState() {
      return currentSnapshot;
    },
  };

  return service;
}

export function assign<Context, Event extends EventObject>(
  updater: (context: Context, event: Event) => Context
): Action<Context, Event> {
  return (context, event, api) => {
    api.setContext((prev) => updater(prev, event));
  };
}

function deepClone<T>(value: T): T {
  if (value == null) return value as T;
  const sc = (globalThis as any).structuredClone as undefined | (<U>(v: U) => U);
  return sc ? sc(value) : JSON.parse(JSON.stringify(value));
}

function normalizeInvoke<T>(result: Promise<T> | { promise: Promise<T>; cancel?: () => void }) {
  if (isPromise<T>(result)) {
    return { promise: result, cancel: undefined };
  }
  return result;
}

function isPromise<T>(value: unknown): value is Promise<T> {
  return !!value && typeof (value as any).then === "function";
}


