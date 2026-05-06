# MD03 URL Shortener Pro — v3 Adding Validation

## The Attack

You thought TypeScript was enough. Then a user sent this:

```json
POST /shorten
{ "url": "ftp://attacker.com/malware.exe", "customCode": "admin" }
```

Your shortener accepted an FTP URL. The redirect sends users to a malware download. The custom code `"admin"` impersonates your internal system.

Then someone automated:
```bash
for i in {1..100000}; do
  curl -X POST http://localhost:3000/shorten -d '{"url":"http://x.com"}'
done
```

Your memory map explodes. The server crashes.

## The Fix: Defense in Depth

### 1. Request Validation (Zod)

```ts
import { z } from 'zod';

const urlSchema = z.string().url().refine(
  (u) => u.startsWith('http://') || u.startsWith('https://'),
  { message: 'Only HTTP and HTTPS URLs are allowed' }
);

const customCodeSchema = z.string()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Code must be alphanumeric')
  .refine(
    (c) => !['admin', 'api', 'health', 'static'].includes(c.toLowerCase()),
    { message: 'Reserved code' }
  );

const shortenSchema = z.object({
  url: urlSchema,
  customCode: customCodeSchema.optional(),
  expiresInHours: z.number().int().min(1).max(8760).optional(), // max 1 year
});

export type ShortenRequest = z.infer<typeof shortenSchema>;
```

### 2. Business Rule Validation

```ts
async function shorten(req: ShortenRequest, ownerId?: string): Promise<ShortUrl> {
  // Blocklist check
  const blockedDomains = await getBlockedDomains();
  const urlObj = new URL(req.url);
  if (blockedDomains.has(urlObj.hostname)) {
    throw new Error('Domain blocked');
  }

  // Rate limit check
  const recentCount = await db.query(
    'SELECT COUNT(*) FROM short_urls WHERE created_at > NOW() - INTERVAL \'1 hour\' AND (owner_id = $1 OR ip = $2)',
    [ownerId, clientIp]
  );
  const limit = ownerId ? 100 : 10; // authenticated vs anonymous
  if (parseInt(recentCount.rows[0].count) >= limit) {
    throw new Error('Rate limit exceeded');
  }

  // Code uniqueness
  const code = req.customCode || await generateUniqueCode();
  if (req.customCode) {
    const existing = await db.query('SELECT 1 FROM short_urls WHERE code = $1', [code]);
    if (existing.rows.length > 0) {
      throw new Error('Code already in use');
    }
  }

  const expiresAt = req.expiresInHours
    ? new Date(Date.now() + req.expiresInHours * 3600000)
    : null;

  await db.query(
    'INSERT INTO short_urls (code, long_url, owner_id, expires_at, created_at) VALUES ($1, $2, $3, $4, NOW())',
    [code, req.url, ownerId, expiresAt]
  );

  return { code: code as ShortCode, longUrl: req.url, createdAt: new Date(), expiresAt: expiresAt || undefined };
}
```

### 3. Database Constraints

```sql
CREATE TABLE short_urls (
  code VARCHAR(32) PRIMARY KEY,
  long_url TEXT NOT NULL,
  owner_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  CHECK (char_length(code) >= 3 AND char_length(code) <= 32)
);

CREATE INDEX idx_short_urls_expires ON short_urls (expires_at)
WHERE expires_at IS NOT NULL;
```

## The Bug

Two simultaneous requests with the same `customCode` can both pass the uniqueness check and then both insert. The database PK catches it, but one client gets a 500 instead of a clean "code in use" error.

**Next:** Let's add logging and observability so we can track abuse patterns.
