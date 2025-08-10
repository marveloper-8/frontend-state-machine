import { useEffect, useRef, useSyncExternalStore } from "react";
export function useStateMachine(createService) {
    const serviceRef = useRef(null);
    if (!serviceRef.current) {
        serviceRef.current = createService();
    }
    useEffect(() => {
        const svc = serviceRef.current;
        svc.start();
        return () => {
            svc.stop();
        };
    }, []);
    const service = serviceRef.current;
    const subscribe = (listener) => {
        const unsubscribe = service.subscribe(() => {
            listener();
        });
        return () => unsubscribe();
    };
    const getSnapshot = () => service.getState();
    const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    const send = (event) => {
        var _a;
        (_a = serviceRef.current) === null || _a === void 0 ? void 0 : _a.send(event);
    };
    return [state, send];
}
//# sourceMappingURL=useStateMachine.js.map