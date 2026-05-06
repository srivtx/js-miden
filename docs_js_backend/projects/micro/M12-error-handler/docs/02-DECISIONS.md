# Architecture Decisions

## Decision: Error Response Format

### Option A: Plain JSON `{ error: "..." }`
**Pros:**
- Extremely simple to implement.
- Minimal payload size.

**Cons:**
- No standard field names. One API uses `error`, another uses `message`, another uses `description`.
- No way to include a URL with documentation about the error.
- No way to include the request path or a unique error ID.
- Clients must write custom parsers for every API they consume.

### Option B: RFC 7807 Problem Details
**Pros:**
- Standardized fields (`type`, `title`, `status`, `detail`, `instance`).
- Machine-readable. Clients can rely on consistent field names.
- Extensible. You can add custom fields (e.g., `errorId`, `retryAfter`).
- Well-documented standard with wide industry adoption.

**Cons:**
- Slightly more verbose than plain JSON.
- Requires learning the spec.

### Option C: GraphQL-Style Errors Array
**Pros:**
- Works well with GraphQL.
- Can return multiple errors at once.

**Cons:**
- Overkill for REST APIs.
- Forces a nested array structure that most REST clients do not expect.

### What We Chose: Option B
**Why:** RFC 7807 is the closest thing REST has to a universal error format. Using it means any client library that understands Problem Details can parse your errors without custom code. The verbosity cost is negligible compared to the interoperability gain.

**What If We Chose Wrong:** Plain JSON would force every consumer to write custom error parsing. GraphQL-style would confuse REST consumers.

**Research Backing:** RFC 7807 is published by IETF and adopted by Spring Boot, ASP.NET Core, and OpenAPI generators.

---

## Decision: Stack Trace Exposure

### Option A: Always Include Stack Traces
**Pros:**
- Makes debugging trivial. Developers see exactly where the error occurred.

**Cons:**
- **Major security risk in production.** Leaks file paths, dependency versions, internal logic, and sometimes secrets in variable names.
- Attackers use stack traces to fingerprint frameworks and find known CVEs.

### Option B: Never Include Stack Traces
**Pros:**
- Completely safe. Zero information leakage.

**Cons:**
- Production debugging becomes a nightmare. You get "Internal Server Error" with no clue where it happened.
- Forces reliance on external log aggregation, which may have delays.

### Option C: Include Only in Non-Production
**Pros:**
- Best of both worlds. Developers see stacks locally. Production is safe.
- Simple to implement: check `NODE_ENV`.

**Cons:**
- Requires discipline in CI/CD to set `NODE_ENV=production` correctly.
- Some PaaS platforms default to `development` if misconfigured.

### What We Chose: Option C
**Why:** There is no legitimate reason to expose stack traces in production. The `isDev` check costs one boolean comparison and eliminates an entire class of security vulnerabilities.

**What If We Chose Wrong:** Always including stacks would leak internals. Never including them would make production debugging painful.

**Research Backing:** OWASP recommends never exposing stack traces in production. The 2017 Equifax breach involved partial stack trace leakage that helped attackers map the system.

---

## Decision: Async Error Handling Strategy

### Option A: Manual try/catch + next(err) in Every Route
**Pros:**
- Explicit. Every developer can see exactly how errors flow.
- Works in Express 4 and Express 5.

**Cons:**
- Repetitive boilerplate in every async route.
- Easy to forget a try/catch, leading to unhandled rejections.

### Option B: Express 5 Default Behavior
**Pros:**
- Zero boilerplate. Express 5 automatically catches rejected promises and forwards them to the error handler.
- Native support, no wrapper functions needed.

**Cons:**
- Requires Express 5 (which was in beta for years and only recently stabilized).
- Developers coming from Express 4 may not realize this behavior exists.

### Option C: Wrapper Function (e.g., `asyncHandler`)
**Pros:**
- Works with Express 4.
- Centralizes async error catching in one place.

**Cons:**
- Adds an extra function call to every route.
- Another abstraction to learn and maintain.
- Unnecessary in Express 5.

### What We Chose: Option B
**Why:** This project uses Express 5, which handles async errors natively. We use explicit try/catch in routes where we want to transform errors (e.g., validation failures), but for unexpected async errors, we rely on Express 5.

**What If We Chose Wrong:** Manual try/catch everywhere would add noise. A wrapper function would be unnecessary indirection.

**Research Backing:** Express 5 release notes document automatic promise rejection handling. The Express team recommends this approach over wrapper functions.

---

## Decision: Double-Response Protection (`res.headersSent`)

### Option A: Ignore It
**Pros:**
- Simpler error handler code.

**Cons:**
- If an error occurs after the response is sent, Node.js throws `ERR_HTTP_HEADERS_SENT` and **crashes the process**.
- In production, this means a 502 Bad Gateway for the user and a pod restart.

### Option B: Check `res.headersSent`
**Pros:**
- Prevents crashes.
- Allows logging the error without writing to the response.

**Cons:**
- One extra boolean check per error.
- The user gets no error response (because the response was already sent), which can be confusing.

### Option C: Use a Library (e.g., `finalhandler`)
**Pros:**
- Handles edge cases like partial writes and aborted requests.

**Cons:**
- Another dependency.
- Overkill for a micro project.

### What We Chose: Option B
**Why:** A single `if (res.headersSent)` check is trivial to add and eliminates an entire class of process crashes. It is the minimum viable fix.

**What If We Chose Wrong:** Ignoring it would make the server fragile. A library would add unnecessary weight.

**Research Backing:** Node.js documentation explicitly warns that calling `res.writeHead()` after headers are sent throws an error. The Express docs recommend checking `res.headersSent` in error handlers.

---

## Decision: Error IDs for Tracking

### Option A: No Error IDs
**Pros:**
- Simpler response payload.

**Cons:**
- When a user reports "I got an error," you have no way to find it in the logs.
- Support teams cannot correlate user reports with server-side traces.

### Option B: Sequential Numbers (1, 2, 3...)
**Pros:**
- Small, human-readable IDs.

**Cons:**
- Race conditions in multi-process setups. Two workers might generate the same ID.
- Predictable IDs allow attackers to enumerate errors.

### Option C: UUIDs or Nanoids
**Pros:**
- Globally unique across all servers and all time.
- Unpredictable (no enumeration attacks).
- Standard format that logging systems can index.

**Cons:**
- Slightly longer than sequential numbers (36 chars vs 3-4 chars).
- `crypto.randomUUID()` is fast enough for any realistic load.

### What We Chose: Option C
**Why:** `crypto.randomUUID()` generates 122 random bits. The probability of collision is effectively zero. The cost is ~1 microsecond per call. The benefit is permanent, unambiguous log correlation.

**What If We Chose Wrong:** No IDs would make support impossible. Sequential IDs would collide in clusters.
