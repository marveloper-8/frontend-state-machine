import { EventObject, MachineConfig, assign, createMachine, interpret } from "../core/StateMachine.js";

export type RequestContext<Request, Response> = {
  requestInput?: Request;
  response?: Response;
  error?: unknown;
  startedAt?: number;
  finishedAt?: number;
};

export type RequestEvent<Request> =
  | (EventObject & { type: "FETCH"; input?: Request })
  | (EventObject & { type: "RETRY" })
  | (EventObject & { type: "CANCEL" });

export function createRequestMachine<Request, Response>(
  requestFn: (input: Request | undefined) => Promise<Response>
) {
  const machineConfig: MachineConfig<RequestContext<Request, Response>, RequestEvent<Request>> = {
    context: {},
    initial: "idle",
    states: {
      idle: {
        on: {
          FETCH: [
            {
              target: "loading",
              actions: [
                assign((ctx, evt) => ({
                  ...ctx,
                  requestInput: (evt as any).input,
                  error: undefined,
                  response: undefined,
                })),
              ],
            },
          ],
        },
      },
      loading: {
        entry: [assign((ctx) => ({ ...ctx, startedAt: Date.now() }))],
        invoke: {
          src: (ctx) => requestFn(ctx.requestInput),
          onDone: {
            target: "success",
            actions: [
              assign((ctx, _e) => {
                const e = _e as unknown as { data: Response };
                return { ...ctx, response: e.data, finishedAt: Date.now() };
              }),
            ],
          },
          onError: {
            target: "failure",
            actions: [
              assign((ctx, _e) => {
                const e = _e as unknown as { error: unknown };
                return { ...ctx, error: e.error, finishedAt: Date.now() };
              }),
            ],
          },
        },
        on: {
          CANCEL: [{ target: "idle" }],
        },
        tags: ["loading"],
      },
      success: {
        tags: ["success"],
        on: {
          FETCH: [{ target: "loading" }],
        },
      },
      failure: {
        tags: ["error"],
        on: {
          RETRY: [{ target: "loading" }],
          FETCH: [{ target: "loading" }],
        },
      },
    },
  };

  const machine = createMachine(machineConfig);
  return interpret(machine);
}


