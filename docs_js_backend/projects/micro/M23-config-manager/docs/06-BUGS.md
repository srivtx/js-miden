# BUGS: Config Manager

## Bug 1: No Atomic File Write

### Location

`src/config-manager.ts` - `save()` method, lines 27-36

### How to Introduce

```typescript
async save(): Promise<void> {
  const obj: Record<string, any> = {};
  for (const [key, value] of this.cache) {
    obj[key] = value;
  }

  // BUG: No atomic update - direct write can corrupt config on crash
  const json = JSON.stringify(obj, null, 2);
  await fs.writeFile(this.configPath, json, 'utf-8');
}
```

### Why This Bug Exists

`fs.writeFile` on Node.js calls `fs.open` (which truncates the file to 0 bytes), then writes data. If the process crashes between truncate and write completion, the file is empty or partially written.

### Symptoms

1. **Application fails to start after crash**
   ```
   Error: Unexpected end of JSON input
   at JSON.parse (<anonymous>)
   ```

2. **Config file is 0 bytes**
   ```bash
   ls -la config.json
   # -rw-r--r--  1 user group 0 May  6 10:00 config.json
   ```

3. **Partial JSON written**
   ```json
   {
     "api.port": 3000,
     "db.host": "local
   ```
   (truncated mid-string)

### Reproduction

```bash
# Start the service
npm start

# Set a config value
curl -X POST http://localhost:3000/config \
  -H "Content-Type: application/json" \
  -d '{"key":"important","value":"data"}'

# Verify file exists and is valid
cat config.json
# { "important": "data" }

# Simulate crash during write by sending SIGKILL while writing
# (In practice, this happens during OOM kills or power failures)
```

**Failing test:**
```typescript
it('should not corrupt config on crash', async () => {
  await manager.set('key', 'value');

  // Simulate crash by checking temp file
  const tmpExists = await fs.access(`${manager.configPath}.tmp`)
    .then(() => true)
    .catch(() => false);

  expect(tmpExists).toBe(false); // May fail if crash happened mid-write
});
```

### The Fix

```typescript
async save(): Promise<void> {
  const obj: Record<string, any> = {};
  for (const [key, value] of this.cache) {
    obj[key] = value;
  }

  const json = JSON.stringify(obj, null, 2);
  const tmpPath = `${this.configPath}.tmp`;

  // Write to temp file first
  await fs.writeFile(tmpPath, json, 'utf-8');

  // Atomic rename
  await fs.rename(tmpPath, this.configPath);
}
```

**Why the fix works:**
- `fs.writeFile(tmpPath, ...)` writes to a separate file
- If crash happens during write, `config.json` is untouched
- `fs.rename()` is atomic on POSIX systems: the file is either the old version or the new version, never partial
- On Windows, rename is atomic within the same drive
- Leftover `.tmp` files can be safely cleaned up

---

## Bug 2: No Type Validation

### Location

`src/config-manager.ts` - `set()` method, lines 50-54

### How to Introduce

```typescript
async set(key: string, value: any): Promise<void> {
  // BUG: No validation - accepts any JSON
  this.cache.set(key, value);
  await this.save();
}
```

### Why This Bug Exists

The `any` type in TypeScript disables type checking. The `set` method accepts anything that JSON can represent, including values that will crash downstream code.

### Symptoms

1. **Runtime TypeError far from the source**
   ```typescript
   // Config was set: api.port = "8080" (string)
   server.listen(config.get('api.port')); // TypeError!
   ```

2. **NaN propagation**
   ```typescript
   // Config was set: timeout = "infinite"
   const timeout = parseInt(config.get('timeout')); // NaN
   setTimeout(callback, timeout); // Behaves unpredictably
   ```

3. **Silent failures**
   ```typescript
   // Config was set: enabled = "false" (string)
   if (config.get('enabled')) {
     // This is TRUE because non-empty string is truthy!
   }
   ```

### Reproduction

```bash
# Start the service
npm start

# Set an invalid value
curl -X POST http://localhost:3000/config \
  -H "Content-Type: application/json" \
  -d '{"key":"api.port","value":"not-a-number"}'

# Retrieve it
curl http://localhost:3000/config/api.port
# {"key":"api.port","value":"not-a-number"}
# Should have been rejected!
```

**Failing test:**
```typescript
it('should validate numeric config values', async () => {
  await request(app)
    .post('/config')
    .send({ key: 'api.port', value: 'not-a-number' });

  const res = await request(app).get('/config/api.port');
  expect(typeof res.body.value).not.toBe('string'); // FAILS
});
```

### The Fix

```typescript
private schemas: Map<string, { type: string }> = new Map();

addSchema(key: string, schema: { type: string }): void {
  this.schemas.set(key, schema);
}

private validate(key: string, value: any): void {
  const schema = this.schemas.get(key);
  if (!schema) return;

  if (typeof value !== schema.type) {
    throw new Error(
      `Expected ${schema.type} for ${key}, got ${typeof value}`
    );
  }
}

async set(key: string, value: any): Promise<void> {
  this.validate(key, value);
  this.cache.set(key, value);
  await this.save();
}
```

**Why the fix works:**
- Schema defines expected types per key
- Validation happens at write time, catching errors immediately
- Downstream code can trust that `config.get('api.port')` returns a number
- Clear error messages tell the user exactly what's wrong

---

## Real-World Impact

### Case Study: AWS S3 Outage (February 2017)

An authorized S3 team member executed a command using an established playbook to remove a small number of servers from service. A typo in the input parameters caused far more servers to be removed than intended:

- **Root cause**: A command intended for a small subset of servers was applied to a larger set
- **Impact**: S3 was unavailable in US-East-1 for 4 hours
- **Affected services**: Netflix, Spotify, Airbnb, Reddit, thousands more
- **Cost**: Estimated $150-200M in lost revenue across affected businesses
- **Configuration lesson**: Input validation and safeguards on operational commands are as important as application config validation

### Case Study: Facebook BGP Misconfiguration (October 2021)

A routine maintenance job issued a command to assess global backbone capacity. The command had an unintended effect:

- **Root cause**: A command with incorrect parameters took down all BGP connections between Facebook data centers
- **Impact**: Facebook, Instagram, WhatsApp globally down for ~6 hours
- **Secondary effect**: DNS resolvers couldn't reach Facebook authoritative servers
- **Configuration lesson**: Even infrastructure-level configuration changes need validation, dry-run modes, and rollback procedures

### Case Study: Knight Capital Trading Loss (August 2012)

While primarily a deployment issue, configuration played a key role:

- **Root cause**: New trading software was deployed to 8 servers. On one server, a manual configuration flag was set incorrectly
- **Impact**: That server sent erroneous orders for 45 minutes
- **Cost**: $440 million loss, nearly bankrupted the company
- **Configuration lesson**: Manual configuration changes are high-risk. Automate and validate.

### Case Study: GitLab Data Loss (January 2017)

A database administrator accidentally deleted production data while following runbooks:

- **Root cause**: Ran `rm -rf` on the wrong directory (production instead of staging)
- **Impact**: 300GB of production data deleted
- **Recovery**: 6 hours of data lost, 18-hour recovery process
- **Configuration lesson**: Environment-specific configurations should be validated and clearly labeled. Production operations should require explicit confirmation.

### Prevention

1. **Atomic writes for all file operations**
   - Use temp file + rename pattern
   - Never write directly to the active config file

2. **Validate at the boundary**
   - Every config write must pass schema validation
   - Reject invalid types immediately

3. **Backup before write**
   - Keep N previous versions of config files
   - `config.json`, `config.json.1`, `config.json.2`

4. **Dry-run mode**
   - Allow operators to preview changes before applying

5. **Immutable infrastructure**
   - Deploy new config by deploying new containers
   - Rollback = deploy previous container image
