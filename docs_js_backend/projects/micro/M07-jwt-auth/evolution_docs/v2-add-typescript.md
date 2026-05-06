# v2-add-typescript.md — "I passed the wrong field name"

## The Bug

You build a login endpoint. You destructure the request body:

```js
app.post('/login', (req, res) => {
  const { userId, pasword } = req.body; // <-- typo

  if (!userId || !pasword) {
    return res.status(400).json({ error: 'userId and password required' });
  }

  const user = users.get(userId);
  if (!user || user.pasword !== pasword) { // <-- typo propagates
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ sub: userId }, SECRET, { expiresIn: '1h' });
  res.json({ token });
});
```

`pasword`.

The destructuring creates a variable named `pasword`. The check `!pasword` is always true when the client sends `password` (because `pasword` is undefined). Every login request returns 400: "userId and password required."

You test with `{ userId: "alice", pasword: "secret" }` and it works. Your test data has the same typo as your code. The bug is invisible until a real user tries to log in.

## The 3am Page, Redux

You add token verification:

```js
app.get('/protected', (req, res) => {
  const authHeader = req.headers.authorisation; // typo (British spelling)
  const token = authHeader.split(' ')[1];
  // ...
});
```

`authorisation`. The client sends `Authorization` (American spelling, the HTTP standard). `authHeader` is `undefined`. `split` throws `TypeError: Cannot read properties of undefined`. The server returns 500. Users can't access any protected route.

## Adding TypeScript

```bash
npm install -D typescript @types/node @types/express @types/jsonwebtoken tsx
```

```ts
// src/routes/auth.ts
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

interface LoginBody {
  userId: string;
  password: string;
}

const router = Router();

router.post('/login', (req: Request, res: Response) => {
  const { userId, pasword } = req.body as LoginBody; // <-- RED SQUIGGLE

  if (!userId || !pasword) {
    return res.status(400).json({ error: 'userId and password required' });
  }
  // ...
});
```

> Property 'pasword' does not exist on type 'LoginBody'. Did you mean 'password'?

And for the header:

```ts
const authHeader = req.headers.authorisation; // <-- RED SQUIGGLE
```

> Property 'authorisation' does not exist on type 'IncomingHttpHeaders'. Did you mean 'authorization'?

Both caught before the commit. Both would have been 3am pages.

## What Changed

- Added `@types/express` and `@types/jsonwebtoken`
- Defined `LoginBody` interface for request shapes
- HTTP headers are typed — typos in header names are compiler errors
- CI runs `tsc --noEmit` before deploy

## What We Still Need

TypeScript catches our typos. But it doesn't stop a user from sending `{ userId: null, password: 12345 }`. At runtime, `null` and `12345` are perfectly valid values in TypeScript's eyes (unless we add strict null checks and branded types, which is overkill for this).

For user input, we need runtime validation.
