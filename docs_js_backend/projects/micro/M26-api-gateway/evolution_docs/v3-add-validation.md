# v3: Add Validation — API Gateway

## The Pain

You configure the gateway with a typo:

```typescript
app.use('/users', createProxyMiddleware('htp://localhost:3001'));
```

It compiles. The gateway starts. A request to `/users/profile` crashes with:

```
TypeError: Cannot read properties of undefined (reading 'hostname')
```

Because `new URL('htp://localhost:3001')` throws, but the error is unhandled. The gateway process exits. All routes are down because one route has a bad URL.

## The Solution

Validate target URLs at startup and on every request.

## Before (No Validation)

```typescript
// src/gateway.ts
export function createProxyMiddleware(targetUrl: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const url = new URL(targetUrl); // May throw
    const options = {
      hostname: url.hostname,
      port: url.port,
      // ...
    };
    // ...
  };
}
```

## After (With Validation)

```typescript
// src/validation.ts
export function validateUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL protocol must be http or https' };
    }
    if (!parsed.hostname) {
      return { valid: false, error: 'URL must have a hostname' };
    }
    const port = parseInt(parsed.port);
    if (parsed.port && (isNaN(port) || port < 1 || port > 65535)) {
      return { valid: false, error: 'URL port must be 1-65535' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
```

```typescript
// src/gateway.ts
import { validateUrl } from './validation.js';

export function createProxyMiddleware(targetUrl: string) {
  const validation = validateUrl(targetUrl);
  if (!validation.valid) {
    throw new Error(`Invalid target URL "${targetUrl}": ${validation.error}`);
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const url = new URL(targetUrl);
    // ... safe to use url.hostname, url.port ...
  };
}
```

## The Bug It Catches

- `htp://localhost:3001` → `Error: Invalid target URL "htp://localhost:3001": Invalid URL format`
- `http://localhost:99999` → `Error: Invalid target URL "http://localhost:99999": URL port must be 1-65535`
- `ftp://localhost:3001` → `Error: Invalid target URL "ftp://localhost:3001": URL protocol must be http or https`
- `http://` → `Error: Invalid target URL "http://": URL must have a hostname`

## Why Validation Matters

- **Fail fast**: Bad config crashes at startup, not at first request
- **Isolation**: One bad route doesn't crash the entire gateway
- **Clarity**: `Invalid URL format` is better than `Cannot read properties of undefined`
- **Security**: Reject `file://` and other unexpected protocols

Without validation, a typo in config takes down the gateway. With validation, the typo is caught in `npm start`.
