# M32 Content Negotiation — v7 Production Setup

## The Journey

We started with hardcoded JSON, layered in types, validation, logging, tests, and ESM. Now we have content negotiation that respects client preferences.

## What v7 Adds

- **Manual Accept parsing**: Parses type, subtype, and q-values
- **Quality values**: Respects client preference strength
- **Wildcard handling**: `*/*`, `text/*`, and `*/html` all match correctly
- **Extensible formatters**: Add new formats by extending the map

## The Final Code

```ts
// src/negotiator.ts
export type SupportedFormat = 'json' | 'xml' | 'html' | 'text';

export interface AcceptItem {
  type: string;
  subtype: string;
  q: number;
}

export function parseAcceptHeader(header: string): AcceptItem[] {
  if (!header) return [{ type: '*', subtype: '*', q: 1.0 }];

  return header
    .split(',')
    .map((part) => part.trim())
    .map((part) => {
      const [media, ...params] = part.split(';');
      const [type, subtype] = media.trim().split('/');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const q = qParam ? parseFloat(qParam.trim().slice(2)) : 1.0;
      return { type: type.trim(), subtype: subtype.trim(), q };
    })
    .sort((a, b) => b.q - a.q);
}

export function selectFormat(
  acceptItems: AcceptItem[],
  supported: SupportedFormat[]
): SupportedFormat | null {
  const mimeMap: Record<SupportedFormat, string> = {
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    text: 'text/plain',
  };

  for (const item of acceptItems) {
    for (const format of supported) {
      const [t, s] = mimeMap[format].split('/');
      // Handle exact match, wildcard type, wildcard subtype
      if (
        (item.type === t || item.type === '*') &&
        (item.subtype === s || item.subtype === '*')
      ) {
        return format;
      }
    }
  }

  return null;
}
```

```ts
// src/formatters.ts
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
// src/index.ts
import express, { Request, Response, NextFunction } from 'express';
import { parseAcceptHeader, selectFormat, SupportedFormat } from './negotiator.js';
import { formatResponse } from './formatters.js';

const app = express();
const supportedFormats: SupportedFormat[] = ['json', 'xml', 'html', 'text'];

app.use((req: Request, res: Response, next: NextFunction) => {
  res.negotiate = (data: unknown, status = 200) => {
    const accept = req.get('Accept') || '*/*';
    const items = parseAcceptHeader(accept);
    const format = selectFormat(items, supportedFormats) || 'json';
    const { body, contentType } = formatResponse(data, format);
    res.setHeader('Content-Type', contentType);
    res.status(status).send(body);
  };
  next();
});

declare global {
  namespace Express {
    interface Response {
      negotiate: (data: unknown, status?: number) => void;
    }
  }
}

app.get('/resource', (req: Request, res: Response) => {
  res.negotiate({ message: 'Hello' });
});

app.get('/default', (req: Request, res: Response) => {
  res.negotiate({ default: true });
});

export default app;

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(3000, () => console.log('M32 listening on :3000'));
}
```

## Why This Matters in Production

Without content negotiation, mobile apps get JSON they can't render, browsers get raw data, and legacy integrations fail. Without quality values, a client that mildly prefers JSON gets forced into XML. Without wildcards, monitoring tools that send `Accept: */*` get unexpected formats.

## Pain → Solution Summary

| Version | Pain | Solution |
|---------|------|----------|
| v1 | Hardcoded JSON ignores client preferences | Accept header parsing |
| v2 | Typos in content types | TypeScript `SupportedFormat` union |
| v3 | Malformed q-values break sorting | Runtime validation |
| v4 | No visibility into format selection | Structured logging |
| v5 | Wildcard `*/*` doesn't match | Jest tests for all Accept patterns |
| v6 | CJS module resolution issues | ESM with NodeNext |
| v7 | No wildcard type/subtype handling | Full wildcard support in selectFormat |

## Run It

```bash
PORT=3000 NODE_ENV=production node dist/index.js
```
