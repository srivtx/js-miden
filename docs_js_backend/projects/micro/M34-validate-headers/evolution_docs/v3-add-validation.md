# M34 Validate Headers — v3 Add Validation

## The Bug: Validation Catches USER Bugs

Without validation, your API accepts anything:

```bash
curl -H "Content-Type: image/png" http://localhost:3000/public
curl -H "Authorization: Basic abc" http://localhost:3000/private
curl -H "X-Custom-Token: short" http://localhost:3000/private
```

Your endpoints:
- Parse PNG as JSON → empty body, silent data loss
- Try to verify Basic as Bearer → parser crash, 500 error
- Accept a 5-character token instead of 32 → security bypass

## The Fix: Regex-Based Validation

```ts
// validator.ts
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
      // BUG: Case-sensitive header lookup (fixed in v7)
      const value = req.headers[rule.name];

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

**What this prevents:**
- Invalid Content-Type values
- Malformed Authorization headers
- Missing required custom tokens

## The Pain That Remains

You deploy to production. A client sends `content-type: application/json` (lowercase). Your validator looks for `Content-Type` (PascalCase) and doesn't find it. The request is rejected or warned incorrectly. Users are confused.

## What v4 Fixes

Logging. Production without logs is flying blind.
