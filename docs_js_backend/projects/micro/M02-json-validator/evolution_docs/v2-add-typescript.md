# v2-add-typescript.md — "I passed the wrong field name"

## The Bug

You're building a JSON validator. The client sends structured data. You need to process it.

```js
app.post('/validate', (req, res) => {
  const result = JSON.parse(req.body);
  const user = {
    fullName: result.name,
    emailAddress: result.emial, // <-- typo
    yearsOld: result.age,
  };
  db.save(user);
  res.json({ success: true });
});
```

`emial`. The user's email is `undefined`. The database stores `NULL`. Three days later, marketing runs an email campaign and 40% of the addresses are missing. They blame the frontend. The frontend blames the API. You spend two hours in a blame storm before you find the typo.

JavaScript didn't complain. It just carried the `undefined` forward until something else broke.

## The 3am Page, Redux

A refactor changes the shape of the incoming data:

```js
const result = JSON.parse(req.body);
// Old code expected { name, email, age }
// New code expects { fullName, emailAddress, age }
const user = {
  name: result.name,        // <-- now undefined
  email: result.emailAddress, // <-- undefined
  age: result.age,
};
```

The API still runs. It still returns 200. But every user created after the refactor has `null` for name and email. You don't notice until the data team runs a report.

## Adding TypeScript

```bash
npm install -D typescript @types/node @types/express tsx
```

```ts
// src/types.ts
export interface UserInput {
  name: string;
  email: string;
  age: number;
}

export interface UserOutput {
  fullName: string;
  emailAddress: string;
  yearsOld: number;
}
```

```ts
// src/app.ts
import express, { Request, Response } from 'express';
import { UserInput, UserOutput } from './types.js';

export const app = express();
app.use(express.json());

app.post('/validate', (req: Request, res: Response) => {
  const result: UserInput = req.body;
  const user: UserOutput = {
    fullName: result.name,
    emailAddress: result.emial, // <-- RED SQUIGGLE
    yearsOld: result.age,
  };
  res.json({ valid: true, data: user });
});
```

> Property 'emial' does not exist on type 'UserInput'. Did you mean 'email'?

Caught before the commit. Before the PR. Before production.

And if someone refactors the interface:

```ts
interface UserInput {
  fullName: string; // renamed from 'name'
  email: string;
  age: number;
}
```

Every place that uses `result.name` gets a red underline. TypeScript is a refactoring tool as much as a type checker.

## What Changed

- Added `tsconfig.json` with `"strict": true`
- Defined interfaces for request and response shapes
- Editor catches typos in property names
- CI runs `tsc --noEmit` to prevent shipping type errors

## What We Still Need

TypeScript checks the code *you* write. But the user can still send `{ age: "not-a-number" }`. TypeScript won't stop that at runtime — `req.body` is whatever the client sent.

For user data, we need runtime validation.
