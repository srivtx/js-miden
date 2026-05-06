# Architecture Decisions

## Decision: UUID Generation Method

### Option A: `Math.random()` (BUGGY)
**Pros:**
- Zero dependencies.
- Extremely fast.
- Works in browsers without `crypto`.

**Cons:**
- **NOT cryptographically secure.** The sequence is predictable.
- An attacker who observes a few UUIDs can predict future ones.
- Should NEVER be used for security-sensitive identifiers.

### Option B: `crypto.randomUUID()` (Correct)
**Pros:**
- Built into Node.js (>= 14.17). Zero dependencies.
- Uses the OS CSPRNG (/dev/urandom, CryptGenRandom).
- Fast enough for any realistic workload (~1 microsecond per call).
- Follows RFC 4122 exactly.

**Cons:**
- Not available in older Node.js versions.
- Not available in browsers (use `crypto.randomUUID()` in modern browsers, or the `uuid` package for polyfills).

### Option C: `uuid` npm Package
**Pros:**
- Battle-tested, works in browsers and Node.js.
- Supports v1, v3, v4, v5.
- Polyfills for older environments.

**Cons:**
- One dependency.
- Overkill if you only need v4 in modern Node.js.

### What We Chose: Option B
**Why:** For modern Node.js, `crypto.randomUUID()` is the best choice. It is built-in, fast, secure, and follows the spec exactly. There is no reason to add a dependency for something Node.js provides natively.

**What If We Chose Wrong:** Using `Math.random()` would make UUIDs predictable. Using the `uuid` package would add an unnecessary dependency.

**Research Backing:** Node.js documentation explicitly recommends `crypto.randomUUID()` for UUID generation. OWASP recommends CSPRNGs for all security-sensitive random values.

---

## Decision: Validation Strategy

### Option A: Permissive Regex (`/^[0-9a-f-]{36}$/i`)
**Pros:**
- Simple.
- Accepts almost anything that looks like a UUID.

**Cons:**
- Accepts invalid UUIDs like `gggggggg-gggg-gggg-gggg-gggggggggggg`.
- Accepts wrong versions like `550e8400-e29b-11d4-a716-446655440000` (v1, not v4).
- Accepts wrong variants like `550e8400-e29b-41d4-c716-446655440000` (variant 1100, not RFC 4122).

### Option B: Strict Regex (Version + Variant)
**Pros:**
- Validates version nibble = 4.
- Validates variant nibble = 8, 9, a, or b.
- Rejects malformed and wrong-version UUIDs.

**Cons:**
- Slightly more complex regex.
- Must be updated if you support multiple UUID versions.

### Option C: Parse and Validate Bitwise
**Pros:**
- Most rigorous validation.
- Can extract version and variant for additional checks.

**Cons:**
- More code.
- Overkill for most use cases.

### What We Chose: Option B
**Why:** The strict regex `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i` is the sweet spot. It validates format, version, and variant with a single test.

**What If We Chose Wrong:** A permissive regex would allow invalid UUIDs into the system, causing data integrity issues. Bitwise parsing would be unnecessary indirection.

**Research Backing:** RFC 4122 defines the version and variant bits. The regex is the standard validation pattern used by the `uuid` npm package.

---

## Decision: API Design

### Option A: `GET /generate`
**Pros:**
- Simple. No request body needed.
- Idempotent (well, not really, but close).

**Cons:**
- `GET` should not have side effects. Generating a UUID is technically a side effect (it consumes entropy from the CSPRNG).
- Caches might cache the response, returning the same UUID to multiple clients.

### Option B: `POST /generate`
**Pros:**
- Correct HTTP semantics. `POST` is for creating resources.
- Not cacheable by default.

**Cons:**
- Slightly more complex for simple clients.

### Option C: `GET /uuid` with `Cache-Control: no-store`
**Pros:**
- Simple like Option A.
- Prevents caching.

**Cons:**
- Still uses `GET` for a side-effecting operation.

### What We Chose: Option B
**Why:** `POST /generate` is the correct RESTful design. A UUID is a newly created resource. `POST` prevents caching and signals that the operation is not idempotent.

**What If We Chose Wrong:** `GET` might be cached by intermediaries, causing multiple clients to receive the same UUID.
