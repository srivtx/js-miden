# v2-add-typescript.md — Password Hasher

## The Pain

In v1 (pure JS), we had a typo that caused a runtime crash:

```javascript
app.post('/hash', (req, res) => {
  const { passwrod } = req.body;  // typo: passwrod
  const hash = crypto.createHash('sha256').update(passwrod).digest('hex');
  // Runtime: TypeError: Cannot read property 'update' of undefined
});
```

This only surfaced during a demo. JavaScript silently let `passwrod` be `undefined`.

## The Fix: Add TypeScript

TypeScript catches typos and wrong shapes at compile time:

```typescript
// types.ts
interface HashRequest {
  password: string;
}

interface VerifyRequest {
  password: string;
  hash: string;
}
```

```typescript
// routes.ts
app.post('/hash', (req: Request, res: Response) => {
  const { password } = req.body as HashRequest;
  // Typo like `passwrod` is caught immediately by the compiler
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  res.json({ hash });
});
```

Now `tsc` errors on:
```
routes.ts:3:11 - error TS2339: Property 'passwrod' does not exist on type 'HashRequest'.
```

## But TypeScript Doesn't Catch Everything

TypeScript validates **compile-time** shapes, not **runtime** data. A malicious client can still send:
```json
{ "password": 12345 }
```
TypeScript believes it's a `string`, but at runtime it's a `number`. `crypto.createHash(...).update(12345)` throws.

> **Lesson:** TypeScript eliminates an entire class of developer errors (typos, wrong types). But runtime validation is still required because the network doesn't respect your type declarations.
