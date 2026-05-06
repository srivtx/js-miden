# Architecture Decisions

## Decision: Origin Validation Strategy for Private Endpoints

### Option A: Wildcard `*` (Current Buggy Implementation)
**Pros:**
- Zero configuration.
- Works for any frontend domain without deployment changes.

**Cons:**
- **Security vulnerability.** The CORS spec forbids `*` with credentials. Even if browsers allowed it, any malicious site could read authenticated responses.
- Signals to attackers that the API is misconfigured.
- Cannot be combined with `Access-Control-Allow-Credentials: true`.

### Option B: Reflect Any Origin (`cors({ origin: true })`)
**Pros:**
- Works with credentials.
- Still zero configuration.

**Cons:**
- Allows **any** origin to make credentialed requests. An attacker simply sets `Origin: https://evil.com` in the browser and the server echoes it back.
- Effectively disables origin protection.

### Option C: Explicit Allowlist (Correct)
**Pros:**
- Strict security boundary. Only approved origins receive CORS headers.
- Can be stored in environment variables for different deployments.
- Communicates intent clearly in code.

**Cons:**
- Requires maintenance when new subdomains are added.
- Slightly more code.

### What We Chose: Option C
**Why:** Security is not a place for convenience. An allowlist is the only CORS pattern that provides actual protection for authenticated endpoints. The small maintenance cost is dwarfed by the risk of credential theft.

**What If We Chose Wrong:** If we picked Option A, authenticated responses would be advertised to every origin on the internet. If we picked Option B, any site could phish users and read their private data via AJAX.

**Research Backing:** OWASP CORS Cheat Sheet, MDN CORS docs, and PortSwigger CORS vulnerability research all recommend explicit allowlists for credentialed requests.

---

## Decision: Preflight Cache Duration (`Access-Control-Max-Age`)

### Option A: No Cache
**Pros:**
- Policy changes take effect immediately.
- No stale preflight responses.

**Cons:**
- Every non-simple request costs an extra `OPTIONS` round-trip (~50-200ms).
- At scale, doubles the request count for APIs with many cross-origin clients.

### Option B: Long Cache (86400 seconds / 24 hours)
**Pros:**
- Minimizes preflight round-trips.
- Best for stable APIs with infrequent CORS policy changes.

**Cons:**
- If you revoke an origin or method, browsers with cached preflights continue using the old policy for up to 24 hours.
- Harder to debug CORS issues because the browser silently uses a cached response.

### Option C: Short Cache (600 seconds / 10 minutes)
**Pros:**
- Balances performance and agility.
- Policy changes propagate within minutes.

**Cons:**
- Slightly more preflight traffic than a long cache.

### What We Chose: Option C
**Why:** 600 seconds is the sweet spot. It eliminates the vast majority of preflight overhead while allowing policy changes to roll out quickly. For an API that might add new allowed headers or methods, this is safer than a 24-hour lock-in.

**What If We Chose Wrong:** No cache would hurt perceived latency for SPAs making many API calls. A 24-hour cache would make emergency origin revocation ineffective for hours.

**Research Backing:** Chromium caps `Max-Age` at 2 hours for security reasons. Firefox allows up to 24 hours. Setting 600s is well within all browser limits and aligns with industry practice.

---

## Decision: `Vary: Origin` Header

### Option A: Omit `Vary: Origin`
**Pros:**
- Slightly smaller response headers.
- CDN responses can be shared across origins (faster cache hit rate).

**Cons:**
- **Cache poisoning.** A CDN caches `Access-Control-Allow-Origin: https://app.example.com` and serves it to `https://evil.com`. The browser blocks it, but worse: if credentials were somehow involved, data leaks between origins.
- Violates HTTP caching semantics. The response genuinely varies by `Origin`.

### Option B: Always Include `Vary: Origin`
**Pros:**
- Correct HTTP semantics.
- Prevents shared caches from serving the wrong CORS headers to different origins.
- Required by RFC 7234 when response content varies by request header.

**Cons:**
- Slightly reduced cache hit ratio on shared CDNs (each origin gets its own cached copy).
- One more header byte.

### What We Chose: Option B
**Why:** Correctness trumps micro-optimizations. A shared cache serving the wrong CORS headers is a security incident waiting to happen. The `cors` package automatically adds `Vary: Origin` when using dynamic origin, which is another reason to prefer dynamic reflection over static `*`.

**What If We Chose Wrong:** Omitting `Vary: Origin` could cause intermittent CORS failures for users behind CDNs, especially if one user on `app.example.com` warms the cache and another on `admin.example.com` gets a poisoned response.

---

## Decision: Use `cors` npm Package vs Custom Middleware

### Option A: Custom Middleware
**Pros:**
- Zero dependencies.
- Full control over every header.

**Cons:**
- Easy to get edge cases wrong (preflight handling, method/header parsing, credentials interaction).
- Must manually implement `Vary: Origin`, `Max-Age`, and wildcard rejection with credentials.
- More code to maintain and test.

### Option B: `cors` npm Package
**Pros:**
- Battle-tested by millions of applications.
- Handles preflight, dynamic origin, credentials, and `Vary` correctly.
- Actively maintained by the Express team.

**Cons:**
- One dependency.

### What We Chose: Option B
**Why:** Reinventing CORS middleware is a common source of vulnerabilities. The `cors` package has already been audited, fuzzed, and hardened. The time saved and bugs avoided far outweigh the cost of one small dependency.

**What If We Chose Wrong:** A custom middleware might forget to reject `*` with credentials, or might not send `Vary: Origin`, or might mishandle preflight `OPTIONS`. Each of these has caused real CVEs.
