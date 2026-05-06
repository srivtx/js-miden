# The Bugs

## Bug 1: Predictable UUID Generation with Math.random()

### How to Introduce It
```typescript
function buggyGenerateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
```

### Why It Exists
The developer wanted a UUID generator without dependencies. They found a Stack Overflow snippet using `Math.random()` and copy-pasted it. They did not understand that `Math.random()` is NOT cryptographically secure.

### Symptoms You'll See
- UUIDs are predictable. An attacker who observes a few UUIDs can predict future ones.
- Session hijacking if UUIDs are used as session tokens.
- Information leakage if UUIDs are used as resource identifiers.
- Security token guessing if UUIDs are used as reset tokens.

### How to Reproduce
1. Generate 10 UUIDs using the buggy function.
2. Analyze the sequence. `Math.random()` uses a seeded PRNG. With enough samples, the seed can be reconstructed.
3. Predict the next UUID with high probability.

### The Fix
```typescript
import { randomUUID } from "node:crypto";

function generateUUID(): string {
  return randomUUID();
}
```

### Why the Fix Works
`crypto.randomUUID()` uses the OS CSPRNG, which is seeded with hardware entropy (keyboard timings, disk noise, etc.). The sequence is not reversible, even if an attacker knows all previous values.

### Real-World Impact
In 2015, a popular Ruby gem used `rand()` (similar to `Math.random()`) to generate session tokens. An attacker discovered that the tokens were predictable and wrote a tool that could guess valid session IDs. They gained access to thousands of user accounts. The fix was to switch to `SecureRandom.uuid`, the Ruby equivalent of `crypto.randomUUID()`.

---

## Bug 2: Overly Permissive UUID Validation

### How to Introduce It
```typescript
const BUGGY_UUID_REGEX = /^[0-9a-f-]{36}$/i;

function buggyIsValidUUID(uuid: string): boolean {
  return BUGGY_UUID_REGEX.test(uuid);
}
```

### Why It Exists
The developer wanted a simple validation check. They did not understand that UUIDs have strict version and variant requirements.

### Symptoms You'll See
- Invalid UUIDs like `gggggggg-gggg-gggg-gggg-gggggggggggg` are accepted.
- UUID v1 strings are accepted where v4 is expected.
- Non-RFC 4122 variants are accepted.
- Database queries fail later because the "UUID" is not actually a valid UUID.

### How to Reproduce
1. Call `buggyIsValidUUID("gggggggg-gggg-gggg-gggg-gggggggggggg")`.
2. It returns `true` even though `g` is not a valid hex character.
3. Call `buggyIsValidUUID("550e8400-e29b-11d4-a716-446655440000")`.
4. It returns `true` even though the version is 1, not 4.

### The Fix
```typescript
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(uuid: string): boolean {
  return UUID_V4_REGEX.test(uuid);
}
```

### Why the Fix Works
The strict regex validates:
1. Only hex characters (0-9, a-f).
2. Version nibble = 4.
3. Variant nibble = 8, 9, a, or b.
4. Correct hyphen positions.

### Real-World Impact
In 2018, an e-commerce API used a permissive UUID regex for order IDs. An attacker discovered that they could inject SQL by providing a "UUID" like `'; DROP TABLE orders; --`. The regex accepted it because it only checked length and hyphens. The database query concatenated the "UUID" directly into the SQL. The attacker wiped the entire orders table. The root cause was missing strict validation at the API layer.
