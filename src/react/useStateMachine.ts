import { useEffect, useRef, useSyncExternalStore } from "react";
import { EventObject, Service } from "../core/StateMachine.js";

export function useStateMachine<Context, Event extends EventObject>(
  createService: () => Service<Context, Event>
): [ReturnType<Service<Context, Event>["getState"]>, (event: Event) => void] {
  const serviceRef = useRef<Service<Context, Event> | null>(null);

  if (!serviceRef.current) {
    serviceRef.current = createService();
  }

  useEffect(() => {
    const svc = serviceRef.current!;
    svc.start();
    return () => {
      svc.stop();
    };
  }, []);

  const service = serviceRef.current;

  const subscribe = (listener: () => void) => {
    const unsubscribe = service.subscribe(() => {
      listener();
    });
    return () => unsubscribe();
  };

  const getSnapshot = () => service.getState();

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const send = (event: Event) => {
    serviceRef.current?.send(event);
  };

  return [state, send];
}


