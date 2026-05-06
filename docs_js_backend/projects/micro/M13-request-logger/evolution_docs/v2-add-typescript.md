# v2-add-typescript.md — Request Logger

## The Pain

In v1 (pure JS), we logged with inconsistent shapes:

```javascript
console.log('POST /login', req.body);
console.log({ method: req.method, path: req.path, status: res.statusCode });
console.log(`[${Date.now()}] ${req.method} ${req.path} ${res.statusCode}`);
```

1. Some logs were plain text, some were objects, some were template strings.
2. When we shipped logs to ELK, parsing failed because there was no consistent schema.
3. A typo in a property name (`req.henders`) went unnoticed until a query returned no results.

## The Fix: Add TypeScript

```typescript
// logger.ts
import type { Request, Response, NextFunction } from 'express';

interface LogEntry {
  method: string;
  path: string;
  status: number;
  duration: number;
  userAgent: string | undefined;
  body: unknown;
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const entry: LogEntry = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - start,
      userAgent: req.headers['user-agent'],
      body: req.body,
    };
    console.log(JSON.stringify(entry));
  });

  next();
}
```

TypeScript catches:
```typescript
const entry: LogEntry = {
  method: req.method,
  path: req.henders,  // error TS2339: Property 'henders' does not exist
};
```

## But TypeScript Doesn't Catch Everything

TypeScript knows `req.body` is `unknown`, but it can't enforce redaction. The log entry shape is correct, but it still contains plaintext passwords at runtime.

> **Lesson:** TypeScript enforces consistent log schema. But what goes *inside* the schema (sensitive data) requires runtime redaction logic.
