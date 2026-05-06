# S20 API Versioning — v2 Add TypeScript

## The Bug: Types Catch Version Bugs

You add a transformation layer:

```js
function transformV2toV1(userV2) {
  return {
    id: userV2.id,
    name: `${userV2.firstName} ${userV2.lastName}`,
  };
}
```

**The bug:** A route handler accidentally returns v2 format from the v1 endpoint:

```js
v1Router.get('/users', (req, res) => {
  // Bug: v1 suddenly returns V2 format
  res.json(usersV2);
});
```

Without types, this compiles and deploys. Every v1 client breaks. Another bug:
```js
const accept = req.get('Accept') || '';
if (accept.includes('application/vnd.api.v1+json')) {
  return v1Router(req, res, next);
}
```

The header string is typo-prone. `'vnd.api.v1+json'` vs `'vnd.api.v2+json'` — one character difference, catastrophic behavior change.

## The Fix: Add TypeScript

```ts
// routes.ts
interface UserV1 {
  id: string;
  name: string;
}

interface UserV2 {
  id: string;
  firstName: string;
  lastName: string;
}

export const v1Router = Router();
export const v2Router = Router();

v1Router.get('/users', (req: Request, res: Response) => {
  res.json(usersV2.map(transformV2toV1));
});

export function transformV2toV1(user: UserV2): UserV1 {
  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
  };
}
```

```ts
// index.ts
app.use((req: Request, res: Response, next: NextFunction) => {
  const accept = req.get('Accept') || '';
  if (accept.includes('application/vnd.api.v1+json')) {
    return v1Router(req, res, next);
  }
  // ...
});
```

**What TS catches:**
- `res.json(usersV2)` in v1 handler → type error: `UserV2[]` is not assignable to `UserV1[]`
- Missing `name` field in transformer → compile error
- `transformV2toV1` return type ensures v1 shape

## The Pain That Remains

TypeScript ensures the types are correct, but it doesn't prevent a developer from accidentally changing the v1 route to return v2 data. It doesn't validate that deprecation headers are present. We need runtime validation of response contracts.

## What v3 Fixes

Validation. Ensure every response matches its version contract.
