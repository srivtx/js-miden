# v3: Add Validation — Service Discovery

## The Pain

You register a service:

```json
{ "name": "user-service", "url": "localhost:3001" }
```

Notice: no `http://` protocol. The registry stores it. A client discovers it and tries:

```typescript
fetch('localhost:3001'); // TypeError: Failed to parse URL
```

Or worse:

```json
{ "name": "", "url": "http://localhost:3001" }
```

An empty name breaks the `GET /discover/` route (Express treats it as a different route). Or:

```json
{ "name": "user-service", "url": "http://localhost:3001", "ttl": -1 }
```

A negative TTL means the service is immediately stale.

## The Solution

Validate service registration inputs.

## Before (No Validation)

```typescript
// src/index.ts
app.post('/register', (req: Request, res: Response) => {
  const { name, url } = req.body;
  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }
  const service = registerService(name, url);
  res.status(201).json(service);
});
```

## After (With Validation)

```typescript
// src/validation.ts
export function validateServiceRegistration(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    errors.push('name is required and must be a non-empty string');
  }

  if (!body.url || typeof body.url !== 'string') {
    errors.push('url is required and must be a string');
  } else {
    try {
      const parsed = new URL(body.url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        errors.push('url protocol must be http or https');
      }
      if (!parsed.hostname) {
        errors.push('url must have a hostname');
      }
    } catch {
      errors.push('url must be a valid URL');
    }
  }

  if (body.ttl !== undefined) {
    if (!Number.isInteger(body.ttl) || body.ttl <= 0) {
      errors.push('ttl must be a positive integer');
    }
  }

  return { valid: errors.length === 0, errors };
}
```

```typescript
// src/index.ts
import { validateServiceRegistration } from './validation.js';

app.post('/register', (req: Request, res: Response) => {
  const validation = validateServiceRegistration(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: 'Invalid registration', details: validation.errors });
  }

  const { name, url } = req.body;
  const service = registerService(name, url);
  res.status(201).json(service);
});
```

## The Bug It Catches

- `url: "localhost:3001"` → `400 url must be a valid URL`
- `name: ""` → `400 name is required and must be a non-empty string`
- `url: "ftp://localhost:3001"` → `400 url protocol must be http or https`
- `ttl: -1` → `400 ttl must be a positive integer`

## Why Validation Matters

- **Client safety**: Invalid URLs are rejected before they reach clients
- **Route safety**: Empty names can't break Express routing
- **Protocol safety**: Only HTTP/HTTPS services are allowed
- **TTL sanity**: Negative TTL is caught before it causes immediate eviction

Without validation, the registry becomes a garbage dump of broken URLs. With validation, only valid services are discoverable.
