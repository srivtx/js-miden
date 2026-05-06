# MD03 URL Shortener Pro — v2 Adding TypeScript

## The Bug

You just debugged why a user's custom short code was rejected.

```js
app.post('/shorten', (req, res) => {
  const { url, customCode } = req.body;
  const code = customCode || makeCode();
  urls[code] = url;
});
```

A user sent:
```json
{ "url": "https://example.com", "customCode": "hello world" }
```

Your redirect route is `/:code`. A code with a space breaks URL parsing. The redirect handler crashes. But TypeScript wouldn't have caught this — it's a runtime validation issue. However, TypeScript forces you to define what a valid code looks like:

```ts
type ShortCode = string & { __brand: 'ShortCode' };
```

## The Fix: Types First

```ts
// types.ts
export interface ShortUrl {
  code: ShortCode;
  longUrl: string;
  createdAt: Date;
  expiresAt?: Date;
  ownerId?: string;
}

export interface ClickEvent {
  code: ShortCode;
  timestamp: Date;
  ip: string;
  userAgent: string;
  referrer?: string;
  country?: string;
}

export interface ShortenRequest {
  url: string;
  customCode?: string;
  expiresInHours?: number;
}

export interface AnalyticsSummary {
  totalClicks: number;
  uniqueVisitors: number;
  clicksByDay: Record<string, number>;
  topReferrers: Record<string, number>;
}
```

## The Service Interface

```ts
// shortenerService.ts
export interface IUrlShortenerService {
  shorten(req: ShortenRequest, ownerId?: string): Promise<ShortUrl>;
  resolve(code: string): Promise<string | null>;
  getAnalytics(code: string): Promise<AnalyticsSummary>;
  delete(code: string, ownerId: string): Promise<void>;
}
```

## Why Types Matter Here

A URL shortener has subtle data integrity requirements:
- `code` must be URL-safe (alphanumeric, hyphen, underscore)
- `longUrl` must be a valid HTTP(S) URL
- `expiresAt` must be in the future
- `clicksByDay` must use ISO date keys, not locale strings

TypeScript won't enforce all of these at runtime, but it makes the shape explicit. When you later switch from an in-memory map to PostgreSQL, the types stay the same.

**Next:** Let's add validation so we don't accept `"hello world"` as a short code.
