# WRONG vs RIGHT: Config Manager

## Validation

### WRONG: Accept Any Value

```typescript
async set(key: string, value: any): Promise<void> {
  this.cache.set(key, value);
  await this.save();
}
```

**Why it's wrong**: Setting `'not-a-number'` for `api.port` causes crashes when code tries to use it as a number.

### RIGHT: Validate Before Save

```typescript
async set(key: string, value: any): Promise<void> {
  this.validate(key, value);
  this.cache.set(key, value);
  await this.save();
}

private validate(key: string, value: any): void {
  const schema = this.schemas[key];
  if (!schema) return;

  if (typeof value !== schema.type) {
    throw new Error(
      `Expected ${schema.type} for ${key}, got ${typeof value}`
    );
  }
}
```

**Why it's right**: Catches errors at write time, preventing runtime crashes.

---

## Atomic Updates

### WRONG: Direct Overwrite

```typescript
async save(): Promise<void> {
  await fs.writeFile(this.configPath, JSON.stringify(obj));
}
```

**Why it's wrong**: If the process crashes during write, the config file is partially written and corrupt.

### RIGHT: Atomic Rename

```typescript
async save(): Promise<void> {
  const tmpPath = `${this.configPath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(obj));
  await fs.rename(tmpPath, this.configPath);
}
```

**Why it's right**: The rename is atomic. A crash leaves the old file intact.

---

## Type Safety

### WRONG: Generic Get

```typescript
get(key: string): any {
  return this.cache.get(key);
}

// Usage:
const port = config.get('api.port'); // any type
server.listen(port); // Crash if port is 'not-a-number'
```

**Why it's wrong**: No compile-time or runtime type checking.

### RIGHT: Typed Accessors

```typescript
getNumber(key: string): number {
  const value = this.cache.get(key);
  if (typeof value !== 'number') {
    throw new Error(`Expected number for ${key}`);
  }
  return value;
}

// Usage:
const port = config.getNumber('api.port'); // guaranteed number
server.listen(port); // Safe!
```

**Why it's right**: Types are enforced at runtime.

---

## Secrets

### WRONG: Store Secrets in Config

```typescript
{
  "db.password": "supersecret123"
}
```

**Why it's wrong**: Passwords in plaintext files are security risks.

### RIGHT: Environment Variables

```typescript
getSecret(key: string): string {
  const envKey = `SECRET_${key.toUpperCase()}`;
  const value = process.env[envKey];
  if (!value) throw new Error(`Secret ${key} not set`);
  return value;
}
```

**Why it's right**: Secrets never touch disk in plaintext.
