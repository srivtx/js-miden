# v2-add-typescript.md — "I passed the wrong field name"

## The Bug

You have a simple API. A frontend dev asks for a new endpoint that echoes back a name from the request body.

```js
app.use(express.json());

app.post('/greet', (req, res) => {
  res.json({ message: `Hello, ${req.body.nmae}!` });
});
```

`nmae`. Not `name`.

You test it with Postman using `{ "name": "Alice" }` and it returns `{ message: "Hello, undefined!" }`. You think the frontend is sending the wrong field. The frontend swears they're sending `name`. You spend 45 minutes in a Slack thread before you notice the typo.

This is a bug that costs money. Not because it's hard to fix, but because it ships silently. JavaScript says "undefined is a valid value" and moves on.

## The 3am Page, Redux

It gets worse. You add a health check endpoint:

```js
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestmap: new Date().toISOString() });
});
});
```

Another typo: `timestmap`. The load balancer expects `timestamp`. It marks your server unhealthy. Traffic routes away. You wake up to an empty database and angry users.

JavaScript doesn't care. It happily serializes `{ timestmap: "..." }` and sends it.

## Adding TypeScript

TypeScript doesn't make you write more code. It makes the code you *do* write correct.

```bash
npm install -D typescript @types/node @types/express tsx
npx tsc --init
```

Here's the `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

The key line is `"strict": true`. This turns on all the checks that catch typos, missing properties, and wrong types.

Now rewrite the server:

```ts
// src/app.ts
import express, { Request, Response } from 'express';

export function createApp() {
  const app = express();
  app.use(express.json());

  app.post('/greet', (req: Request, res: Response) => {
    res.json({ message: `Hello, ${req.body.nmae}!` });
  });

  return app;
}
```

The editor immediately underlines `nmae` in red:

> Property 'nmae' does not exist on type 'any'. Did you mean 'name'?

You fix it before committing. The bug never reaches production.

For the health check, define an interface:

```ts
interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
}

app.get('/health', (_req: Request, res: Response) => {
  const response: HealthResponse = {
    status: 'ok',
    timestmap: new Date().toISOString(), // <-- RED SQUIGGLE
  };
  res.json(response);
});
```

> Object literal may only specify known properties, and 'timestmap' does not exist in type 'HealthResponse'. Did you mean to write 'timestamp'?

This isn't about being fancy. This is about catching typos before they cost you sleep.

## What Changed

- `require` → `import` (we'll fully switch to ESM later, but TypeScript handles this)
- `req.body` is still `any` by default — you can type it with an interface
- The editor now prevents an entire class of bugs
- `tsc --noEmit` runs in CI and blocks the PR if there's a type error

## What We Still Need

TypeScript catches *your* bugs. It doesn't catch *user* bugs. If a client sends `{ age: "not-a-number" }`, TypeScript at runtime can't stop it. For that, we need validation.
