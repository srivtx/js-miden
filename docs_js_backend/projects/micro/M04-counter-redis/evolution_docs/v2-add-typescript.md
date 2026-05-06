# v2-add-typescript.md — "I passed the wrong field name"

## The Bug

Your counter API is growing. You add an endpoint to increment by a specific amount:

```js
app.post('/increment', async (req, res) => {
  const amount = req.body.amout; // <-- typo
  const current = await getCount();
  const next = current + amount;
  await setCount(next);
  res.json({ count: next });
});
```

`amout`. `undefined`.

`next` becomes `NaN`. Redis stores `"NaN"`. `parseInt("NaN", 10)` returns `NaN`. The counter is permanently broken. Users see `{"count": null}`.

You spend an hour in `redis-cli` trying to figure out why `GET counter` returns `"NaN"`. You never find the typo because the code that caused it shipped three days ago.

## The 3am Page, Redux

You refactor the storage layer:

```js
// Old: redis.incr('counter')
// New: custom logic
async function increment(amount) {
  const current = await redis.get('counter');
  return redis.set('counter', parseInt(current, 10) + amout);
}
```

The typo `amout` is now deep in the storage layer. Every increment call is broken. The bug propagates silently because there's no type checking at the boundary.

## Adding TypeScript

```bash
npm install -D typescript @types/node @types/express tsx
```

```ts
// src/counter.ts
export async function increment(amount: number): Promise<number> {
  const current = await redis.get('counter');
  const value = parseInt(current || '0', 10) + amount;
  await redis.set('counter', value.toString());
  return value;
}
```

```ts
// src/index.ts
app.post('/increment', async (req, res) => {
  const amount: number = req.body.amout; // <-- RED SQUIGGLE (if you annotate)
  const count = await increment(amount);
  res.json({ count });
});
```

Even better, if you define the request shape:

```ts
interface IncrementRequest {
  amount: number;
}

app.post('/increment', async (req: Request, res: Response) => {
  const body = req.body as IncrementRequest;
  const count = await increment(body.amout); // <-- RED SQUIGGLE
  res.json({ count });
});
```

> Property 'amout' does not exist on type 'IncrementRequest'. Did you mean 'amount'?

Caught at edit time. Not at 3am.

## What Changed

- Added `tsconfig.json` with `"strict": true`
- Function signatures enforce types (`amount: number`)
- Request body shapes are documented via interfaces
- CI runs `tsc --noEmit` to block broken code

## What We Still Need

TypeScript won't catch a user sending `{ amount: "not-a-number" }`. At runtime, `req.body.amount` is a string, but our code assumes it's a number. `parseInt` might save us, or it might produce garbage.

We need runtime validation to catch user bugs.
