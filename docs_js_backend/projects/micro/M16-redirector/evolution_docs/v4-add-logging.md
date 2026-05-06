# M16 Redirector — v4 Add Logging

## The Bug: Production Visibility Crisis

Your redirector handles 10,000 requests/day. You have no idea:
- How many are legitimate vs malicious
- Which URLs are most common
- Whether someone is probing with `javascript:` schemes
- If the validation rules are actually firing

```ts
// Without logging — silent operation
app.post('/redirect', (req, res) => {
  const { url } = req.body;
  if (!isValidRedirectUrl(url)) {
    return res.status(400).json({ error: 'Invalid or unsafe URL' });
  }
  res.redirect(302, url); // Who called this? What URL? No idea.
});
```

A support ticket: *"Our domain was flagged by Google Safe Browsing."* You have zero logs to investigate why.

## The Fix: Structured Logging

```ts
import { logger } from './logger.js';

app.post('/redirect', (req: Request, res: Response) => {
  const { url } = req.body;
  const clientIp = req.ip;
  const requestId = crypto.randomUUID();

  logger.info({ requestId, clientIp, url }, 'Redirect requested');

  if (!url || typeof url !== 'string') {
    logger.warn({ requestId }, 'Missing URL in request body');
    res.status(400).json({ error: 'Missing url in request body' });
    return;
  }

  if (!isValidRedirectUrl(url)) {
    logger.warn({ requestId, url, reason: 'validation_failed' }, 'Blocked invalid redirect URL');
    res.status(400).json({ error: 'Invalid or unsafe URL' });
    return;
  }

  logger.info({ requestId, url, statusCode: 302 }, 'Redirect successful');
  res.redirect(302, url);
});
```

Now your logs tell stories:
```json
{"level":"warn","requestId":"xyz","url":"javascript:alert(1)","reason":"validation_failed","msg":"Blocked invalid redirect URL"}
{"level":"info","requestId":"abc","url":"https://example.com","statusCode":302,"msg":"Redirect successful"}
```

You can now:
- Alert on blocked URL rate spikes
- Audit which IPs are probing
- Prove to Safe Browsing that you block malicious redirects

## The Pain That Remains

You update `isValidRedirectUrl` to also block URLs with credentials (`http://user:pass@evil.com`). You accidentally break hostname parsing. All redirects start failing. Your tests? You don't have any covering the validator logic.

## What v5 Fixes

Testing. Every validation rule needs a test.
