# 03 - Auth Service

## WHAT

The Auth Service manages identity and access for the ApiHub marketplace. It handles developer registration, API key lifecycle, and key validation.

**Responsibilities:**
- Developer registration and profile management
- API key generation using cryptographically secure random bytes
- Key hashing for secure storage (SHA-256)
- Key validation (active, not expired, not revoked)
- Key revocation with immediate effect
- Key listing per developer

## WHY

### Why Separate Key Generation from Validation?

Key generation is a rare operation (once per subscription). Validation happens on EVERY API request. Separating them allows:
- Different scaling patterns (validation service scales horizontally)
- Different security models (generation requires auth, validation is public)
- Caching optimization (validation results cached, generation never cached)

### Why Hash Keys?

API keys are credentials. Storing them in plaintext means:
- Database breach = all keys compromised
- Developers with DB access can impersonate consumers
- No audit trail of who saw what key

Hashing (SHA-256) means even if the database is stolen, attackers can't use the stolen hashes as API keys.

### Why Include API ID in the Key?

Keys are scoped to specific APIs. This prevents a key created for "Weather API" from being used to access "Stock API." This is a defense-in-depth measure.

## HOW

### Key Generation

```typescript
function generateApiKey(): string {
  // 32 random bytes = 256 bits of entropy
  // Prefix helps identify key type in logs
  return `apkh_${randomBytes(32).toString('hex')}`;
}

// Store hash, not raw key
const rawKey = generateApiKey();
const keyHash = hashKey(rawKey); // SHA-256
```

### Key Validation Flow

```
Consumer sends X-API-Key header
    |
    v
Lookup hash in keyHashes map
    |
    v
Fetch ApiKey object by ID
    |
    v
Check status === 'active'
Check Date.now() < expiresAt
    |
    v
Return developerId, apiId, tierId
```

### Key Rotation

Key rotation creates a new key while keeping the old one valid for a grace period:

```typescript
async function rotateKey(oldKeyId: string): Promise<string> {
  const oldKey = apiKeys.get(oldKeyId);
  
  // Create new key
  const newRawKey = generateApiKey();
  const newKey: ApiKey = {
    ...oldKey,
    id: generateId('key'),
    key: newRawKey,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  };
  
  apiKeys.set(newKey.id, newKey);
  keyHashes.set(newRawKey, newKey.id);
  
  // Old key expires in 24 hours (grace period)
  oldKey.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  return newRawKey;
}
```

## WRONG vs RIGHT

### WRONG: Storing Keys in Plaintext

```typescript
// WRONG: Storing raw key
const apiKey: ApiKey = {
  id: generateId('key'),
  key: rawKey, // Stored as-is!
  // ...
};
```

**Why Wrong:** Database dump exposes all active keys. No way to detect if keys were copied by insiders.

### RIGHT: Hashing Keys

```typescript
// RIGHT: Store hash, return raw key only once
const rawKey = generateApiKey();
const keyHash = hashKey(rawKey);

const apiKey: ApiKey = {
  id: generateId('key'),
  key: rawKey, // Only in memory during creation
  // ...
};

apiKeys.set(apiKey.id, apiKey);
keyHashes.set(rawKey, apiKey.id); // Map raw -> ID for validation
// rawKey is given to consumer and NEVER stored again
```

**Why Right:** Even with full database access, an attacker can't use the stored hashes as API keys. They would need to brute-force SHA-256, which is computationally infeasible.

### WRONG: No Ownership Check on Key Lookup

```typescript
// WRONG: lookup/:key returns key data without authentication
router.get('/lookup/:key', (req, res) => {
  const keyId = keyHashes.get(req.params.key);
  const apiKey = apiKeys.get(keyId);
  res.json({ apiKey }); // Anyone can look up anyone's key!
});
```

**Why Wrong:** Information disclosure. An attacker can enumerate keys and discover which developers own which APIs.

### RIGHT: Authenticated Key Lookup

```typescript
// RIGHT: Require developer auth and verify ownership
router.get('/lookup/:key', authenticateDeveloper, (req, res) => {
  const keyId = keyHashes.get(req.params.key);
  const apiKey = apiKeys.get(keyId);
  
  if (!apiKey || apiKey.developerId !== req.developerId) {
    return res.status(404).json({ error: 'Key not found' });
  }
  
  res.json({ apiKey: sanitize(apiKey) }); // Don't return raw key!
});
```

**Why Right:** Developers can only see their own keys. The raw key is never returned after initial creation.

### WRONG: Keys Without Expiration

```typescript
// WRONG: Keys never expire
const key: ApiKey = {
  // ...
  expiresAt: null // Forever!
};
```

**Why Wrong:** Compromised keys remain valid forever. There's no forcing function for rotation.

### RIGHT: Mandatory Expiration with Grace Period

```typescript
// RIGHT: Keys expire annually with rotation support
const key: ApiKey = {
  // ...
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
};

// Automated emails at 30, 14, 7 days before expiration
// Auto-renewal for active subscriptions
```

**Why Right:** Limits the window of exposure for compromised keys. Forces regular rotation. Automated renewal reduces friction for active users.

### WRONG: Single Key Per Subscription

```typescript
// WRONG: Only one key per API subscription
if (hasKey(developerId, apiId)) {
  return res.status(400).json({ error: 'Already subscribed' });
}
```

**Why Wrong:** If a key is leaked, the only option is revocation, causing immediate downtime. No way to separate environments (dev/staging/prod).

### RIGHT: Multiple Keys Per Subscription

```typescript
// RIGHT: Support multiple keys with different purposes
const devKey = await createKey({ developerId, apiId, tierId, label: 'development' });
const prodKey = await createKey({ developerId, apiId, tierId, label: 'production' });
```

**Why Right:** Leaked dev key can be revoked without affecting production. Different rate limits can be applied per environment.
