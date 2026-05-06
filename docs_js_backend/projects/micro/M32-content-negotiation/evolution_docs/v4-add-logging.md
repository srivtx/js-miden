# M32 Content Negotiation — v4 Add Logging

## The Bug: Production Visibility Crisis

You deploy v3. Support ticket arrives: *"My client gets JSON but requested XML."*

You check the code. It looks correct. You have zero visibility into:

- What Accept header did the client send?
- Which format did the server select?
- Why was that format chosen?
- Was it a fallback or an exact match?

```ts
// Without logging — silent mismatch
app.use((req, res, next) => {
  res.negotiate = (data, status = 200) => {
    const accept = req.get('Accept') || '*/*';
    const items = parseAcceptHeader(accept);
    const format = selectFormat(items, supportedFormats) || 'json';
    const { body, contentType } = formatResponse(data, format);
    res.setHeader('Content-Type', contentType);
    res.status(status).send(body);
    // Why JSON? No idea.
  };
  next();
});
```

## The Fix: Structured Logging

```ts
import { logger } from './logger.js';

app.use((req: Request, res: Response, next: NextFunction) => {
  res.negotiate = (data: unknown, status = 200) => {
    const accept = req.get('Accept') || '*/*';
    const requestId = getRequestId(req);

    logger.debug({ requestId, accept }, 'Parsing Accept header');

    const items = parseAcceptHeader(accept);
    logger.debug({ requestId, items }, 'Parsed Accept items');

    const format = selectFormat(items, supportedFormats) || 'json';
    logger.info({ requestId, accept, selectedFormat: format }, 'Format selected');

    const { body, contentType } = formatResponse(data, format);
    res.setHeader('Content-Type', contentType);
    res.status(status).send(body);
  };
  next();
});
```

Now your logs tell the story:
```json
{"level":"debug","requestId":"abc","accept":"application/xml,text/html;q=0.8","msg":"Parsing Accept header"}
{"level":"info","requestId":"abc","selectedFormat":"xml","msg":"Format selected"}
```

## The Pain That Remains

You add wildcard handling. In the process, you break exact matching:

```ts
// BEFORE: exact match works
if (item.type === t && item.subtype === s) return format;

// AFTER: wildcard logic breaks exact match
if (item.type === '*' || item.subtype === '*') return format;
```

Now `application/json` doesn't match because the code only checks wildcards. No test caught it.

## What v5 Fixes

Testing. Silent breakage when adding features is unacceptable.
