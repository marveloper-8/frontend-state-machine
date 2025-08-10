import { EventObject, Service } from "../core/StateMachine.js";
export declare function useStateMachine<Context, Event extends EventObject>(createService: () => Service<Context, Event>): [ReturnType<Service<Context, Event>["getState"]>, (event: Event) => void];
