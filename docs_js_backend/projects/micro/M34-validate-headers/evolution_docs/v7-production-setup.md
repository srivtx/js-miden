# M34 Validate Headers — v7 Production Setup

## The Journey

We started with no validation, layered in types, regex validation, logging, tests, and ESM. Now we have header validation that respects HTTP standards.

## What v7 Adds

- **Case-insensitive lookup**: `content-type`, `Content-Type`, and `CONTENT-TYPE` all work
- **RFC 2616 compliance**: Headers are case-insensitive per the HTTP spec
- **Configurable rules**: Add custom rules via RegExp or functions
- **Strict and lenient modes**: Reject or warn based on endpoint sensitivity

## The Final Code

```ts
// src/validator.ts
import { Request, Response, NextFunction } from 'express';

export type ValidationMode = 'strict' | 'lenient';

export interface HeaderRule {
  name: string;
  required: boolean;
  pattern?: RegExp;
  validate?: (value: string) => boolean;
}

export const defaultRules: HeaderRule[] = [
  {
    name: 'Content-Type',
    required: false,
    pattern: /^(application\/json|text\/plain|application\/xml)(;.*)?$/,
  },
  {
    name: 'Authorization',
    required: false,
    pattern: /^Bearer\s+\S+$/,
  },
];

export function validateHeaders(
  rules: HeaderRule[],
  mode: ValidationMode = 'lenient'
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: string[] = [];

    for (const rule of rules) {
      // Case-insensitive header lookup per RFC 2616
      const headerKey = Object.keys(req.headers).find(
        (h) => h.toLowerCase() === rule.name.toLowerCase()
      );
      const value = headerKey ? req.headers[headerKey] : undefined;

      if (rule.required && (value === undefined || value === '')) {
        errors.push(`Missing required header: ${rule.name}`);
        continue;
      }

      if (value && typeof value === 'string') {
        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(`Invalid format for header ${rule.name}: ${value}`);
        }
        if (rule.validate && !rule.validate(value)) {
          errors.push(`Validation failed for header ${rule.name}`);
        }
      }
    }

    if (errors.length > 0 && mode === 'strict') {
      const err: any = new Error('Header validation failed');
      err.status = 400;
      err.details = errors;
      next(err);
      return;
    }

    if (errors.length > 0 && mode === 'lenient') {
      (req as any).headerWarnings = errors;
    }

    next();
  };
}
```

```ts
// src/index.ts
import express, { Request, Response, NextFunction } from 'express';
import { validateHeaders, defaultRules } from './validator.js';

const app = express();
app.use(express.json());

// Lenient by default
app.use(validateHeaders(defaultRules, 'lenient'));

app.get('/public', (req: Request, res: Response) => {
  res.json({ message: 'public endpoint', warnings: (req as any).headerWarnings });
});

app.post(
  '/private',
  validateHeaders(
    [
      ...defaultRules,
      { name: 'X-Custom-Token', required: true, pattern: /^[A-Z0-9]{32}$/ },
    ],
    'strict'
  ),
  (req: Request, res: Response) => {
    res.json({ message: 'private endpoint' });
  }
);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.status || 500).json({ error: err.message, details: err.details });
});

export default app;

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(3000, () => console.log('M34 listening on :3000'));
}
```

## Why This Matters in Production

Without case-insensitive lookup, clients using lowercase headers (common in HTTP/2) are incorrectly rejected. Without RFC compliance, proxies and load balancers that normalize headers break your validation. Without configurable rules, every new endpoint requires a code change.

## Pain → Solution Summary

| Version | Pain | Solution |
|---------|------|----------|
| v1 | No validation | Basic middleware concept |
| v2 | Typos in header access | TypeScript interfaces |
| v3 | No format checking | Regex-based rules |
| v4 | No visibility into rejections | Structured logging |
| v5 | Case-sensitive lookup rejects valid requests | Jest tests for lowercase headers |
| v6 | CJS module resolution issues | ESM with NodeNext |
| v7 | Case-sensitivity violates RFC 2616 | Case-insensitive lookup |

## Run It

```bash
PORT=3000 NODE_ENV=production node dist/index.js
```
