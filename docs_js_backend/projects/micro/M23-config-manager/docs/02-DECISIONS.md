# DECISIONS: Config Manager

## Decision 1: In-Memory Cache vs Direct File Reads

### Option A: In-Memory Cache (What We Chose)

```typescript
private cache: Map<string, any> = new Map();

get(key: string): any {
  return this.cache.get(key); // O(1), no I/O
}
```

**Pros:**
- Fast reads (no file I/O)
- Simple implementation
- Works for single-instance applications

**Cons:**
- Stale data if file is modified externally
- Lost on restart (unless persisted)
- Not shared across instances

### Option B: Read File on Every Request

```typescript
async get(key: string): Promise<any> {
  const data = await fs.readFile(this.configPath, 'utf-8');
  const parsed = JSON.parse(data);
  return parsed[key];
}
```

**Pros:**
- Always up-to-date
- External changes visible immediately

**Cons:**
- Slow (file I/O on every request)
- JSON.parse on every request
- Race conditions with writes

**Why we chose A:** Reads vastly outnumber writes in most applications. Cache with write-through is the standard pattern. For hot-reload scenarios, add a file watcher.

---

## Decision 2: JSON vs YAML vs TOML

### Option A: JSON (What We Chose)

**Pros:**
- Native to JavaScript/Node.js
- Fast parsing
- Machine and human readable
- No additional dependencies

**Cons:**
- No comments
- No trailing commas (strict syntax)
- Verbose for nested structures

### Option B: YAML

**Pros:**
- Comments allowed
- Less verbose
- Industry standard for Kubernetes/config

**Cons:**
- Requires `js-yaml` dependency
- Slower parsing
- Whitespace-sensitive (error-prone)

### Option C: TOML

**Pros:**
- Designed for configuration
- Comments allowed
- Less verbose than JSON

**Cons:**
- Requires `toml` dependency
- Less familiar to JavaScript developers

**Why we chose A:** JSON is the JavaScript standard. For a micro-project, adding YAML/TOML parsing is unnecessary complexity. Production systems often use YAML for human-edited configs and JSON for machine-generated configs.

---

## Decision 3: Atomic Write Pattern

### Option A: Write to Temp + Rename (The Fix)

```typescript
async save(): Promise<void> {
  const json = JSON.stringify(obj, null, 2);
  const tmpPath = `${this.configPath}.tmp`;
  await fs.writeFile(tmpPath, json, 'utf-8');
  await fs.rename(tmpPath, this.configPath);
}
```

**Pros:**
- Atomic on POSIX systems (rename is atomic)
- Crash-safe: temp file may be left behind, but main file is intact

**Cons:**
- Uses 2x disk space briefly
- `fs.rename` is not atomic on Windows across drives

### Option B: Write Directly (The Bug)

```typescript
await fs.writeFile(this.configPath, json, 'utf-8');
```

**Pros:**
- Simple
- No temp files

**Cons:**
- Non-atomic: file can be partially written
- Crash during write = corrupted config

**Why we chose B (intentional bug):** The bug simulates the naive approach. The fix (Option A) is the production standard.

### Option C: Append to Log + Compaction

```typescript
// Write changes as append-only log
await fs.appendFile(this.configPath + '.log', JSON.stringify(change) + '\n');
// Periodically compact log to snapshot
```

**Pros:**
- Full history
- Never corrupts existing data

**Cons:**
- Complex
- Log grows unbounded

**When to use:** When you need audit trails or event sourcing.

---

## Decision 4: Schema Validation Strategy

### Option A: Runtime Type Checking (What We Chose)

```typescript
private validate(key: string, value: any): void {
  const schema = this.schemas.get(key);
  if (schema && typeof value !== schema.type) {
    throw new Error(`Expected ${schema.type} for ${key}, got ${typeof value}`);
  }
}
```

**Pros:**
- Simple
- No dependencies

**Cons:**
- Manual schema definition
- Limited (no range validation, no nested validation)

### Option B: JSON Schema (ajv)

```typescript
import Ajv from 'ajv';
const ajv = new Ajv();

const schema = {
  type: 'object',
  properties: {
    port: { type: 'number', minimum: 1024, maximum: 65535 },
  },
};
```

**Pros:**
- Standard (JSON Schema)
- Rich validation (ranges, patterns, nested objects)
- Auto-generated error messages

**Cons:**
- Additional dependency
- Schema definition is verbose

**Why we chose A:** Micro-project scope. For production, use JSON Schema or Zod.

### Option C: Zod (TypeScript-First)

```typescript
import { z } from 'zod';

const ConfigSchema = z.object({
  port: z.number().min(1024).max(65535),
  host: z.string().min(1),
});
```

**Pros:**
- TypeScript-native
- Excellent error messages
- Inferred types

**Cons:**
- Additional dependency
- Runtime overhead (small)

**Why we chose A:** Zod is the 2025 standard for TypeScript validation. Our manual validation is a teaching stepping stone.
