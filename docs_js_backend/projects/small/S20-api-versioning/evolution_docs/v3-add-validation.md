# S20 API Versioning — v3 Add Validation

## The Bug: Validation Catches Version Bugs

Your TypeScript API accepts any request:

```ts
v1Router.get('/users', (req: Request, res: Response) => {
  res.json(usersV2.map(transformV2toV1));
});
```

Without validation:
- A developer accidentally changes `v1Router` to return `usersV2` directly
- The `Accept` header is missing — the version negotiation falls through silently
- A client sends `application/vnd.api.v3+json` — it's not handled, falls through to default
- The `Sunset` header is forgotten on a deprecated endpoint

TypeScript ensures the types match, but it doesn't enforce version contracts at runtime.

## The Fix: Runtime Version Validation

```ts
function validateV1Response(user: unknown): asserts user is UserV1 {
  const u = user as any;
  if (typeof u.id !== 'string') throw new Error('V1 response missing id');
  if (typeof u.name !== 'string') throw new Error('V1 response missing name');
  if (u.firstName !== undefined) throw new Error('V1 response must not include firstName');
  if (u.lastName !== undefined) throw new Error('V1 response must not include lastName');
}

function validateV2Response(user: unknown): asserts user is UserV2 {
  const u = user as any;
  if (typeof u.id !== 'string') throw new Error('V2 response missing id');
  if (typeof u.firstName !== 'string') throw new Error('V2 response missing firstName');
  if (typeof u.lastName !== 'string') throw new Error('V2 response missing lastName');
  if (u.name !== undefined) throw new Error('V2 response must not include name');
}
```

```ts
v1Router.get('/users', (req: Request, res: Response) => {
  const response = usersV2.map(transformV2toV1);
  response.forEach(validateV1Response);
  res.json(response);
});
```

**What validation prevents:**
- Accidental v2 data in v1 responses is caught at runtime
- Missing required fields are rejected before they reach clients
- Extra fields that break older clients are flagged

## The Pain That Remains

You validate responses, but you still have no visibility into which versions clients are using. When v1 usage drops, you don't know if you can deprecate it. There's no logging of version distribution or migration progress.

## What v4 Fixes

Logging. Observe API version usage in production.
