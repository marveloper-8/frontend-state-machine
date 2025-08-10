## Frontend State Machine

A tiny, dependency-free state machine for the frontend. Written in TypeScript, ships modern ESM, has first-class async (invoke), and comes with an optional React hook. Great for forms, API flows, and UI state that shouldn’t be a tangle of booleans.

### Install

```
npm install frontend-state-machine
```

Or use it locally while developing this repo:

```
npm install
npm run build
```

### Quick start

```ts
import { createMachine, interpret, assign } from "frontend-state-machine";

type Ctx = { count: number };
type Inc = { type: "INC" };
type Reset = { type: "RESET" };

const machine = createMachine<Ctx, Inc | Reset>({
  context: { count: 0 },
  initial: "idle",
  states: {
    idle: {
      on: {
        INC: [{ actions: [assign((ctx) => ({ ...ctx, count: ctx.count + 1 }))] }],
        RESET: [{ actions: [assign(() => ({ count: 0 }))] }],
      },
    },
  },
});

const service = interpret(machine).start();
service.subscribe((s) => console.log(s.context.count));
service.send({ type: "INC" });
```

### React (optional)

```tsx
import { useStateMachine } from "frontend-state-machine/react";
import { createFormMachine } from "frontend-state-machine";

function LoginForm() {
  const [state, send] = useStateMachine(() =>
    createFormMachine({
      initialValues: { email: "", password: "" },
      validate(values) {
        const errors: Record<string, string | undefined> = {};
        if (!values.email) errors.email = "Email required";
        if (!values.password) errors.password = "Password required";
        return errors;
      },
      submit: async (values) => {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        if (!res.ok) throw new Error("Login failed");
        return res.json();
      },
    })
  );

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    send({ type: "CHANGE", name: e.target.name, value: e.target.value });

  return null;
}
```

### API at a glance

- createMachine({ context, initial, states })
- interpret(machine).start()
- assign((ctx, evt) => ({ ...ctx, ... }))
- State node features: on, entry, exit, invoke, tags

### Publish to npm

1. Update `package.json`:
   - `name`, `version`, `description`, `keywords`, `author`, `license`
   - Ensure `main`, `module`, `types`, and `exports` point to `dist/`
2. Build: `npm run build`
3. Login: `npm login`
4. Publish:
   - Public package: `npm publish --access public`
   - Scoped private package: `npm publish`
5. (Optional) Tag and push a release: `git tag v1.0.0 && git push --tags`

After publishing, consumers can:

```ts
import { createMachine } from "frontend-state-machine";
import { useStateMachine } from "frontend-state-machine/react";
```

### Suggested npm description

Tiny, dependency-free TypeScript state machine. Simple API, first class async (invoke), and an optional React hook, perfect for forms and API flows.


