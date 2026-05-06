# Old Ways vs New Ways (2025)

## Pattern: UUID Generation

### The Old Way (2015-2020)
```javascript
// Using Math.random() - NOT cryptographically secure
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
```
**Why we did it:** It was the top Stack Overflow answer. It worked in browsers without `crypto`. It was fast.

**Why it is wrong now:**
1. `Math.random()` is predictable. An attacker who observes a few UUIDs can predict future ones.
2. Not suitable for security-sensitive identifiers (sessions, tokens).
3. The `uuid` npm package existed but many developers copy-pasted the `Math.random()` snippet instead.

### The New Way (2025)
```typescript
import { randomUUID } from 'node:crypto';

function generateUUID(): string {
  return randomUUID();
}
```
**Why it is better:**
1. Uses the OS CSPRNG. Unpredictable and secure.
2. Built into Node.js. Zero dependencies.
3. Follows RFC 4122 exactly.
4. Fast enough for any realistic workload.

**When to still use old way:** Never for security-sensitive IDs. Only for non-security purposes like generating fake data for UI demos, and even then, `crypto.randomUUID()` is just as easy.

### Migration Path
1. Replace all `Math.random()` UUID generation with `crypto.randomUUID()`.
2. Audit all places where UUIDs are used as security tokens.
3. Add validation to ensure only properly formatted UUIDs are accepted.

---

## Pattern: UUID Validation

### The Old Way (2015-2020)
```javascript
// Overly permissive
function isValidUUID(uuid) {
  return /^[0-9a-f-]{36}$/i.test(uuid);
}
```
**Why we did it:** It was simple and seemed to work.

**Why it is wrong now:**
1. Accepts invalid hex characters (e.g., `gggggggg-gggg-gggg-gggg-gggggggggggg`).
2. Accepts wrong versions (e.g., v1 UUIDs where v4 is expected).
3. Accepts wrong variants (e.g., non-RFC 4122 variants).
4. Can lead to data integrity issues if invalid UUIDs are stored in the database.

### The New Way (2025)
```typescript
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(uuid: string): boolean {
  return UUID_V4_REGEX.test(uuid);
}
```
**Why it is better:**
1. Validates hex characters only.
2. Validates version = 4.
3. Validates variant = 8, 9, a, or b.
4. Prevents invalid UUIDs from entering the system.

**When to still use old way:** Never. There is no legitimate reason to use a permissive UUID regex.

### Migration Path
1. Replace all permissive UUID regexes with the strict version + variant regex.
2. Add tests that assert invalid UUIDs are rejected.
3. Audit the database for any invalid UUIDs that slipped through.
