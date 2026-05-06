# Troubleshooting

## Cross-Tenant Data Leak

**Symptom:** User sees data from other companies.

**Cause:** Missing RLS or spoofable tenant ID.

**Fix:**
```typescript
// Look up tenant by API key, not header
const apiKey = req.headers['x-api-key'];
const keyRecord = await db.query(
  'SELECT tenant_id FROM api_keys WHERE key_hash = $1',
  [hash(apiKey)]
);
const tenantId = keyRecord.rows[0].tenant_id;
// Ignore X-Tenant-ID header entirely
```

## Rate Limit Exhausted

**Symptom:** All tenants blocked when one is busy.

**Cause:** Global rate limit instead of per-tenant.

**Fix:**
```typescript
const key = `rate_limit:${tenantId}`;
const current = await redis.incr(key);
if (current === 1) await redis.expire(key, 60);
if (current > limit) throw new RateLimitError();
```

## API Key Leak

**Symptom:** Unauthorized access with valid key.

**Fix:**
- Implement key rotation
- Short expiration (90 days)
- Audit all key usage
- Revocation list
