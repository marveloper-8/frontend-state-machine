export function createMachine(config) {
    return {
        config,
    };
}
export function interpret(machine) {
    var _a, _b;
    const config = machine.config;
    let currentStateValue = config.initial;
    let currentContext = deepClone(config.context);
    let running = false;
    let listeners = [];
    let processing = false;
    const queue = [];
    let currentSnapshot = {
        value: currentStateValue,
        context: currentContext,
        changed: false,
        tags: (_b = (_a = config.states[currentStateValue]) === null || _a === void 0 ? void 0 : _a.tags) !== null && _b !== void 0 ? _b : [],
    };
    let activeInvokeToken = null;
    let activeInvokeCancel = null;
    let lastEventForInvoke = null;
    const getStateSnapshot = (changed) => {
        var _a, _b;
        const tags = (_b = (_a = config.states[currentStateValue]) === null || _a === void 0 ? void 0 : _a.tags) !== null && _b !== void 0 ? _b : [];
        return { value: currentStateValue, context: currentContext, changed, tags };
    };
    const notify = (changed) => {
        // Only notify React subscribers when the snapshot actually changed.
        if (!changed)
            return;
        currentSnapshot = getStateSnapshot(true);
        for (const listener of listeners.slice())
            listener(currentSnapshot);
    };
    const stopInvoke = () => {
        activeInvokeToken = null;
        if (activeInvokeCancel) {
            try {
                activeInvokeCancel();
            }
            catch {
            }
            finally {
                activeInvokeCancel = null;
            }
        }
    };
    const maybeStartInvoke = (enteredByEvent) => {
        const stateNode = config.states[currentStateValue];
        if (!(stateNode === null || stateNode === void 0 ? void 0 : stateNode.invoke))
            return;
        const { src, onDone, onError, autoStart = true } = stateNode.invoke;
        if (!autoStart)
            return;
        const token = Date.now() + Math.random();
        activeInvokeToken = token;
        lastEventForInvoke = enteredByEvent;
        const invokeApi = {
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
            const result = src(currentContext, (lastEventForInvoke !== null && lastEventForInvoke !== void 0 ? lastEventForInvoke : { type: "@@init" }), invokeApi);
            const { promise, cancel } = normalizeInvoke(result);
            activeInvokeCancel = typeof cancel === "function" ? cancel : null;
            promise
                .then((data) => {
                var _a, _b;
                if (activeInvokeToken !== token)
                    return;
                if ((_a = stateNode.invoke) === null || _a === void 0 ? void 0 : _a.onDone) {
                    applyTransition(stateNode.invoke.onDone, { ...lastEventForInvoke, type: ((_b = lastEventForInvoke === null || lastEventForInvoke === void 0 ? void 0 : lastEventForInvoke.type) !== null && _b !== void 0 ? _b : "done.invoke") }, { data });
                }
                else {
                }
            })
                .catch((error) => {
                var _a, _b;
                if (activeInvokeToken !== token)
                    return;
                if ((_a = stateNode.invoke) === null || _a === void 0 ? void 0 : _a.onError) {
                    applyTransition(stateNode.invoke.onError, { ...lastEventForInvoke, type: ((_b = lastEventForInvoke === null || lastEventForInvoke === void 0 ? void 0 : lastEventForInvoke.type) !== null && _b !== void 0 ? _b : "error.invoke") }, { error });
                }
                else {
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
    const runActions = (actions, event) => {
        if (!actions || actions.length === 0)
            return;
        let nextContext = currentContext;
        const api = {
            setContext: (updater) => {
                nextContext =
                    typeof updater === "function"
                        ? updater(nextContext)
                        : updater;
            },
            send: (evt) => service.send(evt),
        };
        for (const action of actions)
            action(nextContext, event, api);
        currentContext = nextContext;
    };
    const applyTransition = (transition, triggeringEvent, supplemental) => {
        const stateNode = config.states[currentStateValue];
        const target = transition.target;
        const isInternal = !target || target === currentStateValue;
        if (!isInternal) {
            runActions(stateNode.exit, triggeringEvent);
            stopInvoke();
        }
        runActions(transition.actions, supplemental !== null && supplemental !== void 0 ? supplemental : triggeringEvent);
        if (!isInternal) {
            currentStateValue = target;
            const nextStateNode = config.states[currentStateValue];
            runActions(nextStateNode.entry, triggeringEvent);
            maybeStartInvoke(triggeringEvent);
        }
    };
    const service = {
        start(initialContext) {
            var _a;
            if (running)
                return service;
            running = true;
            currentContext = { ...deepClone(config.context), ...(initialContext !== null && initialContext !== void 0 ? initialContext : {}) };
            currentStateValue = config.initial;
            runActions((_a = config.states[currentStateValue]) === null || _a === void 0 ? void 0 : _a.entry, { type: "@@init" });
            maybeStartInvoke({ type: "@@init" });
            currentSnapshot = getStateSnapshot(true);
            notify(true);
            return service;
        },
        stop() {
            if (!running)
                return;
            stopInvoke();
            running = false;
            listeners = [];
        },
        send(event) {
            var _a;
            if (!running)
                return;
            queue.push(event);
            if (processing)
                return;
            processing = true;
            try {
                while (queue.length) {
                    const evt = queue.shift();
                    const stateNode = config.states[currentStateValue];
                    const maybeTransitions = (_a = stateNode.on) === null || _a === void 0 ? void 0 : _a[evt.type];
                    if (!maybeTransitions) {
                        notify(false);
                        continue;
                    }
                    const transitions = Array.isArray(maybeTransitions)
                        ? maybeTransitions
                        : [maybeTransitions];
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
            }
            finally {
                processing = false;
            }
        },
        subscribe(listener) {
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
export function assign(updater) {
    return (context, event, api) => {
        api.setContext((prev) => updater(prev, event));
    };
}
function deepClone(value) {
    if (value == null)
        return value;
    const sc = globalThis.structuredClone;
    return sc ? sc(value) : JSON.parse(JSON.stringify(value));
}
function normalizeInvoke(result) {
    if (isPromise(result)) {
        return { promise: result, cancel: undefined };
    }
    return result;
}
function isPromise(value) {
    return !!value && typeof value.then === "function";
}
//# sourceMappingURL=StateMachine.js.map