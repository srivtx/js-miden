# S12 URL Expander — Database

## Schema

This project does not use a persistent database. State is ephemeral per request.

## In-Memory Chain Tracking

During expansion, the redirect chain is stored in a JavaScript array:
```typescript
const chain: string[] = [];
```

This array is scoped to the request and garbage-collected after the response is sent.

## Decision: No Database

### Why No Database?
URL expansion is a pure function: input URL → output chain. There is no need for persistence.

### When to Add a Database
1. **Caching**: Store `url → {final_url, chain, expires_at}` to avoid re-expanding popular short URLs.
2. **Analytics**: Track which URLs are expanded most frequently, by which IPs, and when.
3. **Malware filtering**: Maintain a blocklist of known malicious destinations.

### Recommended Cache Schema (if needed)
```sql
CREATE TABLE url_cache (
  url TEXT PRIMARY KEY,
  final_url TEXT NOT NULL,
  chain TEXT NOT NULL, -- JSON array
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
```

## Decision: In-Memory vs. Persistent Blocklists

### In-Memory Blocklist (Current)
- **Pros**: Zero latency, no setup.
- **Cons**: Requires app restart to update, lost on crash.

### Persistent Blocklist (Redis/SQL)
- **Pros**: Shared across instances, updatable without restart.
- **Cons**: Adds latency to every request.
