# v2-add-typescript.md — CORS Tester

## The Pain

In v1 (pure JS), we installed `cors` and copy-pasted config from StackOverflow without understanding it:

```javascript
const cors = require('cors');

// Private routes — BUGGY config
app.use('/private', cors({ origin: '*', credentials: true }), privateRouter);
```

1. `origin: '*'` with `credentials: true` is a **security vulnerability** that TypeScript can't catch.
2. But TypeScript **can** catch typos in option names:
   ```javascript
   cors({ orgin: '*' })  // typo — silent failure in JS
   ```

## The Fix: Add TypeScript

```typescript
// app.ts
import cors, { CorsOptions } from 'cors';

const publicCors: CorsOptions = { origin: '*' };

const privateCors: CorsOptions = {
  origin: (origin, callback) => {
    const allowed = ['https://app.example.com'];
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use('/public', cors(publicCors), publicRouter);
app.use('/private', cors(privateCors), privateRouter);
```

TypeScript now catches:
```typescript
cors({ orgin: '*' });
// error TS2345: Object literal may only specify known properties,
// but 'orgin' does not exist in type 'CorsOptions'.
```

## But TypeScript Doesn't Catch Everything

TypeScript validates the **shape** of `CorsOptions`, not the **security** of the values. `origin: '*'` with `credentials: true` is perfectly valid TypeScript — and perfectly wrong for security.

> **Lesson:** TypeScript prevents configuration typos. But security logic (allowlists vs wildcards) is a human decision, not a type-checker decision.
