# M32 Content Negotiation — v2 Add TypeScript

## The Bug: Types Catch YOUR Bugs

You refactor v1 to support multiple formats:

```js
app.get('/resource', (req, res) => {
  const accept = req.headers.accept || 'application/json';
  if (accept.includes('html')) {
    res.send('<html><body>Hello</body></html>');
  } else if (accept.includes('xml')) {
    res.type('applicaiton/xml'); // typo: applicaiton
    res.send('<?xml version="1.0"?><root>Hello</root>');
  } else {
    res.json({ message: 'Hello' });
  }
});
```

**The bug:** `applicaiton` is a typo. The `Content-Type` header is wrong. The client parser rejects the response. TypeScript would catch this if you used a typed constant instead of a raw string.

Another bug: `accept` can be an array:

```js
// When a client sends multiple Accept headers, req.headers.accept is an array
const accept = req.headers.accept;
if (accept.includes('html')) { // TypeError: accept.includes is not a function
```

## The Fix: Add TypeScript

```ts
// formatters.ts
export type SupportedFormat = 'json' | 'xml' | 'html' | 'text';

export interface FormattedResponse {
  body: string;
  contentType: string;
}

export function formatResponse(data: unknown, format: string): FormattedResponse {
  switch (format) {
    case 'json':
      return { body: JSON.stringify(data), contentType: 'application/json' };
    case 'xml':
      return {
        body: `<?xml version="1.0"?><root>${JSON.stringify(data)}</root>`,
        contentType: 'application/xml',
      };
    case 'html':
      return {
        body: `<html><body><pre>${JSON.stringify(data, null, 2)}</pre></body></html>`,
        contentType: 'text/html',
      };
    case 'text':
      return {
        body: typeof data === 'string' ? data : JSON.stringify(data),
        contentType: 'text/plain',
      };
    default:
      return { body: JSON.stringify(data), contentType: 'application/json' };
  }
}
```

```ts
// index.ts
import { formatResponse, SupportedFormat } from './formatters.js';

const supportedFormats: SupportedFormat[] = ['json', 'xml', 'html', 'text'];
```

Now `tsc` errors on:
```
index.ts:5:28 - error TS2345: Argument of type 'string' is not assignable to parameter of type 'SupportedFormat'.
```

## But TypeScript Doesn't Catch Everything

TypeScript validates **compile-time** shapes, not **runtime** behavior. A client can still send:
```
Accept: application/json; q=not-a-number
```
TypeScript sees a string, but at runtime the `q` value is unparseable. We need runtime validation.

> **Lesson:** TypeScript eliminates typos and wrong shapes. But runtime validation is required because HTTP headers are strings.

## What v3 Fixes

Validation. Reject malformed Accept headers before parsing.
