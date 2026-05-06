# 02-DECISIONS.md

## Decision 1: Cart ID Generation

**Chosen:** Sequential counter (`cart-1`, `cart-2`) to demonstrate the vulnerability.

**Alternatives:**
- **UUID v4**: Standard, 122 bits of randomness. Universally supported.
- **CUID2**: Collision-resistant, URL-safe, sortable. Modern alternative to UUID.
- **NanoID**: Smaller than UUID, just as unpredictable. Popular in frontend.

**Why sequential:** Makes the session fixation bug obvious. One glance at the code or test output reveals the vulnerability.

---

## Decision 2: Storage Backend

**Chosen:** In-memory `Map<string, Cart>`.

**Alternatives:**
- **Redis with EXPIRE**: Native TTL support, perfect for session data. Already configured in docker-compose.
- **PostgreSQL with `created_at` + cron job**: Durable, supports complex analytics (cart abandonment funnels). Requires cleanup logic.
- **DynamoDB with TTL attribute**: Serverless, auto-expires items. AWS-specific.

**Why in-memory:** Self-contained. The expiry bug is about missing logic, not missing infrastructure.

---

## Decision 3: Merge Strategy

**Chosen:** Add quantities for matching products, append for new products.

**Alternatives:**
- **Replace strategy**: Guest cart overwrites user cart. Loses saved items—bad UX.
- **Max quantity strategy**: Take the higher quantity of matching products. Rare but valid for some businesses.
- **Conflict resolution UI**: Show user a modal to choose. Best UX but requires frontend work.

**Why add quantities**: Standard e-commerce behavior (Amazon, Shopify). Intuitive for users.

---

## Decision 4: Session Transport

**Chosen:** Cart ID returned in JSON body. Client must send it back in subsequent requests.

**Alternatives:**
- **Signed cookie**: Server sets `cartId` in a signed, httpOnly cookie. Prevents tampering and XSS theft.
- **JWT claim**: Embed `cartId` in the authentication JWT. Ties cart to identity.
- **LocalStorage**: Frontend stores the ID. Vulnerable to XSS but works for guest carts.

**Why JSON body:** Simplest for API testing with curl. Production would use signed cookies.

---

## Decision 5: Language / Runtime

**Chosen:** TypeScript + Node.js.

**Alternatives:**
- **Go**: Fast, type-safe. Good for high-throughput checkout systems.
- **Python + FastAPI**: Rapid development. Common in e-commerce startups.
- **Java + Spring**: Enterprise retail standard (Walmart, Target).

**Why Node.js:** Express is the most accessible framework for demonstrating HTTP security concepts.
