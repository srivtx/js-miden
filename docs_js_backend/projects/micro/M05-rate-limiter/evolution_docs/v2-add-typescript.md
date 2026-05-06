# v2-add-typescript.md — "I passed the wrong field name"

## The Bug

You configure the rate limiter with environment variables:

```js
const WINDOW_SIZE_MS = parseInt(process.env.WINDOW_MS, 10);
const MAX_REQUESTS = parseInt(process.env.MAX_REQS, 10);
```

Later, you add a new config:

```js
const WINDOW_SIZE_MS = parseInt(process.env.WINDOW_MS, 10);
const MAX_REQUESTS = parseInt(process.env.MAX_REQS, 10);
const BLOCK_DURATION = parseInt(process.env.BLOCK_DURATON, 10); // <-- typo
```

`BLOCK_DURATON`. `NaN`.

The rate limiter code later does:

```js
res.setHeader('Retry-After', String(BLOCK_DURATION / 1000));
```

`NaN / 1000` is `NaN`. The `Retry-After` header is `NaN`. Some clients cache this response forever because they can't parse the header. Others retry immediately. Your rate limiter is now a random behavior generator.

You don't notice until someone pastes the `NaN` header into a bug report.

## The 3am Page, Redux

You refactor the middleware signature:

```js
async function rateLimiter(req, res, next) {
  const identifer = req.ip || req.socket.remoteAddress; // typo
  // ...
}
```

`identifer` is `undefined` on every request because `req.ip` exists but you never read it — you read `identifer`, which is a new variable. Every request gets the key `ratelimit:undefined:...` and shares a single global counter. One user hitting the API blocks everyone else.

## Adding TypeScript

```bash
npm install -D typescript @types/node @types/express tsx
```

```ts
// src/config.ts
export interface RateLimitConfig {
  windowSizeMs: number;
  maxRequests: number;
  blockDurationMs: number;
}

export const config: RateLimitConfig = {
  windowSizeMs: parseInt(process.env.WINDOW_MS || '60000', 10),
  maxRequests: parseInt(process.env.MAX_REQS || '10', 10),
  blockDurationMs: parseInt(process.env.BLOCK_DURATON || '60000', 10), // <-- RED SQUIGGLE
};
```

> Property 'blockDurationMs' is missing in type '{ windowSizeMs: number; maxRequests: number; blockDurationMs: number; }' but required in type 'RateLimitConfig'. Did you mean 'BLOCK_DURATION_MS'?

Wait, that's not the error you'd get. Let's be precise. The actual error:

```ts
export const config: RateLimitConfig = {
  windowSizeMs: parseInt(process.env.WINDOW_MS || '60000', 10),
  maxRequests: parseInt(process.env.MAX_REQS || '10', 10),
  blockDurationMs: parseInt(process.env.BLOCK_DURATON || '60000', 10),
};
```

Actually, with the typo in the env var name, TypeScript wouldn't catch that unless we had a strict env var typing system. But the real value is in the refactor scenario:

```ts
async function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const identifer = req.ip || req.socket.remoteAddress || 'unknown'; // <-- RED SQUIGGLE?
```

Actually, TypeScript wouldn't catch `identifer` as a typo unless we had a variable already declared. But if we did:

```ts
const identifier = req.ip || req.socket.remoteAddress || 'unknown';
const key = `ratelimit:${identifer}:...`; // <-- RED SQUIGGLE
```

> Cannot find name 'identifer'. Did you mean 'identifier'?

Yes. That catches it.

## What Changed

- `tsconfig.json` with `"strict": true`
- Config interfaces prevent missing or mistyped fields
- Request/response types from `@types/express` provide autocomplete
- CI blocks type errors before deploy

## What We Still Need

TypeScript checks our code. It doesn't validate that the config values are sane at runtime. If `MAX_REQUESTS` is set to `"not-a-number"`, `parseInt` returns `NaN` and TypeScript thinks it's a `number`.

For user input and environment variables, we need runtime validation.
