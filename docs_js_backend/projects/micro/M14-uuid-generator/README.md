# M14: UUID Generator

## Phase 1: Basic Functionality

- **POST /generate** — Returns a cryptographically secure UUID v4.
- **GET /validate/:uuid** — Validates whether the provided string matches the UUID v4 format (including version and variant bits).

## Phase 2: Technical Thinking

### crypto.randomUUID() vs uuid library

- **crypto.randomUUID()** (Node.js ≥ 14.17): Built-in, zero dependencies, CSPRNG-backed, fast. Preferred for modern Node.js.
- **uuid npm package**: Battle-tested, works in browsers, supports v1/v3/v4/v5. Use when you need versions other than v4 or browser compatibility.

### UUID Format Validation Regex

A correct UUID v4 regex must enforce:
- 8-4-4-4-12 hex character grouping
- Version nibble = `4` (13th character)
- Variant nibble = `8`, `9`, `a`, or `b` (17th character)

```
/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
```

### Collision Probability

UUID v4 has 122 random bits. Using the birthday paradox:
- To reach a **50% collision probability**, you need approximately **2.71 × 10^18 UUIDs** (2.71 quintillion).
- At a generation rate of 1 billion UUIDs per second, it would take ~86 years to have a 50% chance of a single collision.
- For practical purposes, UUID v4 collisions are negligible.

## Phase 3: Design Decisions

- **Security**: Always use `crypto.randomUUID()` or a CSPRNG. Never use `Math.random()` for UUIDs.
- **Validation**: Strict regex prevents accepting UUID-like strings with wrong version/variant bits.
- **Performance**: No database or external dependency — pure in-memory generation.

## Bug

See `bug/bug.ts`:
- Uses `Math.random()` instead of `crypto.randomUUID()` → predictable UUIDs.
- Uses overly permissive regex `/^[0-9a-f-]{36}$/i` → accepts invalid UUIDs like `gggggggg-gggg-gggg-gggg-gggggggggggg`.

## Running

```bash
npm install
npm run dev     # Start server
npm test        # Run tests
```
