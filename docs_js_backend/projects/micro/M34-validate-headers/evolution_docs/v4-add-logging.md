# M34 Validate Headers — v4 Add Logging

## The Bug: Production Visibility Crisis

You deploy v3. Support ticket arrives: *"My request was rejected but the headers look correct."*

You check the code. It looks correct. You have zero visibility into:

- What headers did the client actually send?
- Which rule failed?
- Was it case-sensitive lookup or format mismatch?
- What was the expected vs actual value?

```ts
// Without logging — silent rejection
app.use(validateHeaders(defaultRules, 'strict'));

app.get('/public', (req, res) => {
  res.json({ message: 'public endpoint' });
  // If validation failed, the client gets 400 with no context
});
```

## The Fix: Structured Logging

```ts
import { logger } from './logger.js';

export function validateHeaders(
  rules: HeaderRule[],
  mode: ValidationMode = 'lenient'
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: string[] = [];
    const requestId = getRequestId(req);

    logger.debug({ requestId, headers: req.headers }, 'Validating headers');

    for (const rule of rules) {
      const value = req.headers[rule.name];

      if (rule.required && (value === undefined || value === '')) {
        errors.push(`Missing required header: ${rule.name}`);
        continue;
      }

      if (value && typeof value === 'string') {
        if (rule.pattern && !rule.pattern.test(value)) {
          logger.warn({ requestId, header: rule.name, value }, 'Header format mismatch');
          errors.push(`Invalid format for header ${rule.name}: ${value}`);
        }
      }
    }

    if (errors.length > 0 && mode === 'strict') {
      logger.warn({ requestId, errors }, 'Header validation failed (strict mode)');
      const err: any = new Error('Header validation failed');
      err.status = 400;
      err.details = errors;
      next(err);
      return;
    }

    next();
  };
}
```

Now your logs tell the story:
```json
{"level":"debug","requestId":"abc","headers":{"content-type":"application/json"},"msg":"Validating headers"}
{"level":"warn","requestId":"abc","header":"Content-Type","value":"application/json","msg":"Header format mismatch"}
```

Wait — `content-type` is lowercase but the rule name is `Content-Type`. The log reveals the case-sensitivity bug.

## The Pain That Remains

You fix the case-sensitivity bug by lowercasing the rule name. But you forget to handle the case where `req.headers` already lowercases keys. Now `req.headers['content-type']` works, but `req.headers['Content-Type']` doesn't. No test caught it.

## What v5 Fixes

Testing. Silent breakage when adding features is unacceptable.
