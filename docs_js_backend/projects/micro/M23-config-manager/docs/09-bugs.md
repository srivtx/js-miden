# Bugs: Config Manager

## Bug 1: No Validation

### Location
`src/config-manager.ts` - `set()` method

### The Bug

```typescript
async set(key: string, value: any): Promise<void> {
  // BUG: No validation - accepts any JSON
  this.cache.set(key, value);
  await this.save();
}
```

### Expected Behavior
Should reject invalid types (e.g., string where number expected).

### Actual Behavior
Accepts any JSON value. Downstream code crashes when reading wrong type.

### Impact
- Runtime crashes
- Type errors in production
- Difficult debugging
- Data corruption

### Failing Test
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

---

## Bug 2: No Atomic Update

### Location
`src/config-manager.ts` - `save()` method

### The Bug

```typescript
async save(): Promise<void> {
  const json = JSON.stringify(obj, null, 2);
  await fs.writeFile(this.configPath, json, 'utf-8');
}
```

### Expected Behavior
Config should never be partially written.

### Actual Behavior
If process crashes during write, config file is corrupted.

### Impact
- Config corruption on crash
- Application fails to start
- Data loss
- Recovery requires manual intervention

### Failing Test
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
