import { EventObject } from "../core/StateMachine.js";
export type RequestContext<Request, Response> = {
    requestInput?: Request;
    response?: Response;
    error?: unknown;
    startedAt?: number;
    finishedAt?: number;
};
export type RequestEvent<Request> = (EventObject & {
    type: "FETCH";
    input?: Request;
}) | (EventObject & {
    type: "RETRY";
}) | (EventObject & {
    type: "CANCEL";
});
export declare function createRequestMachine<Request, Response>(requestFn: (input: Request | undefined) => Promise<Response>): import("../core/StateMachine.js").Service<RequestContext<Request, Response>, RequestEvent<Request>>;
