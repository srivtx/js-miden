# CRITIQUE: Config Manager

## Senior Engineer Review

### What's Missing

#### 1. No Schema Definition System

**Current state:** `set()` accepts `any`.
**What's missing:** A way to define expected types and constraints.

**Impact:**
- `api.port = "8080"` is accepted
- `timeout = -1` is accepted
- `hosts = "single-host"` when array expected is accepted

**Fix:**
```typescript
const schemas = {
  'api.port': z.number().min(1024).max(65535),
  'db.host': z.string().min(1),
  'features.cache': z.boolean(),
};
```

#### 2. No Config Hierarchy

**Current state:** Single `config.json`.
**What's missing:** Environment-specific overlays.

**Impact:**
- Can't have different values for dev/staging/prod
- Must maintain separate files manually

#### 3. No File Watching / Hot Reload

**Current state:** Config loaded once at startup.
**What's missing:** Automatic reload when file changes.

**Impact:**
- Every config change requires restart
- No zero-downtime updates

**Fix:**
```typescript
import { watch } from 'fs';

watch(configPath, debounce(() => {
  manager.load().catch(err => logger.error('Reload failed', err));
}, 100));
```

#### 4. No Backup/Versioning

**Current state:** Only one config file.
**What's missing:** History of changes.

**Impact:**
- Can't rollback bad changes
- No audit trail
- Accidental deletion = data loss

#### 5. No Encryption for Secrets

**Current state:** Plaintext JSON.
**What's missing:** Encrypted values or secret references.

**Impact:**
- Passwords in plaintext on disk
- Security vulnerability if file is exposed

### Security Concerns

#### 1. Path Traversal in Config Path

```typescript
constructor(configPath: string = './config.json') {
  this.configPath = path.resolve(configPath);
}
```

**Risk:** If user-controlled input reaches `configPath`:
```typescript
new ConfigManager(req.query.path); // Could be /etc/passwd
```

**Fix:** Validate path is within project directory:
```typescript
const resolved = path.resolve(configPath);
if (!resolved.startsWith(process.cwd())) {
  throw new Error('Config path must be within project directory');
}
```

#### 2. No Authentication on Write Endpoints

```typescript
app.post('/config', async (req, res) => {
  await manager.set(req.body.key, req.body.value);
});
```

**Risk:** Anyone can modify configuration, including:
- Setting `admin.enabled = false`
- Changing database credentials
- Enabling debug mode (information disclosure)

**Fix:** Add authentication and authorization:
```typescript
app.post('/config', requireAuth, requireRole('admin'), async (req, res) => {
  // ...
});
```

#### 3. Arbitrary JSON Write

```typescript
app.post('/config/bulk', async (req, res) => {
  await manager.setMultiple(req.body);
});
```

**Risk:** `req.body` could contain:
- Prototype pollution (`__proto__.isAdmin = true`)
- Circular references (crash on JSON.stringify)
- Massive objects (memory exhaustion)

**Fix:**
```typescript
app.post('/config/bulk', async (req, res) => {
  if (typeof req.body !== 'object' || req.body === null) {
    return res.status(400).json({ error: 'Invalid body' });
  }
  if (Object.keys(req.body).length > 100) {
    return res.status(400).json({ error: 'Too many keys' });
  }
  await manager.setMultiple(req.body);
});
```

#### 4. Information Disclosure via GET /config

```typescript
app.get('/config', (req, res) => {
  res.json(manager.getAll());
});
```

**Risk:** Returns all configuration including potential secrets.

**Fix:** Filter sensitive keys or require authentication.

#### 5. No Rate Limiting

Write endpoints can be hammered, causing excessive disk I/O.

**Fix:** Add rate limiting middleware.

### Architecture Concerns

#### 1. Synchronous Writes Block Event Loop

```typescript
async set(key: string, value: any): Promise<void> {
  this.cache.set(key, value);
  await this.save(); // File I/O
}
```

While `fs/promises` is non-blocking, frequent writes to the same file create I/O contention.

#### 2. No Batch Persistence

Every `set()` triggers a file write. 100 updates = 100 file writes.

**Fix:** Debounce writes:
```typescript
private saveTimeout: NodeJS.Timeout | null = null;

async set(key: string, value: any): Promise<void> {
  this.cache.set(key, value);
  if (this.saveTimeout) clearTimeout(this.saveTimeout);
  this.saveTimeout = setTimeout(() => this.save(), 100);
}
```

#### 3. Test Reliance on Global State

```typescript
beforeEach(async () => {
  (manager as any).cache = new Map();
});
```

**Smell:** Tests mutate global singleton. Better to create a new `ConfigManager` per test.

### Recommendations for Production

| Priority | Item | Effort |
|----------|------|--------|
| P0 | Add schema validation (Zod or JSON Schema) | 2 days |
| P0 | Add authentication to write endpoints | 1 day |
| P0 | Sanitize bulk update input | 0.5 day |
| P1 | Add file watching / hot reload | 1 day |
| P1 | Add config versioning/backup | 2 days |
| P1 | Encrypt sensitive values | 3 days |
| P2 | Debounce file writes | 0.5 day |
| P2 | Add environment-specific overlays | 2 days |
