# Module 05: API Design - REST, GraphQL & Building APIs That Don't Suck

> **"An API is a user interface for developers. Bad APIs create bad software."**

Building APIs is easy. Building APIs that scale, evolve, and don't make your frontend team cry is hard. In this module, we move beyond "it works in Postman" to designing APIs that are predictable, documented, and production-ready.

---

## Table of Contents

1. [What Makes a Good API?](#what-makes-a-good-api)
2. [REST API Design: The Right Way](#rest-api-design-the-right-way)
3. [Error Handling with RFC 7807](#error-handling-with-rfc-7807)
4. [API Versioning Strategies](#api-versioning-strategies)
5. [OpenAPI 3.1 Documentation](#openapi-31-documentation)
6. [Input Validation with Zod](#input-validation-with-zod)
7. [When to Choose GraphQL over REST](#when-to-choose-graphql-over-rest)
8. [Real-World Consequences of Getting It Wrong](#real-world-consequences-of-getting-it-wrong)
9. [Mini Project: Task Management API](#mini-project-task-management-api)

---

## What Makes a Good API?

### WHAT Is Developer Experience (DX)?

Developer Experience is the sum of every interaction a developer has with your API. It includes:

- **Consistency**: The same pattern works everywhere
- **Predictability**: `GET /users` behaves like `GET /tasks`
- **Discoverability**: Developers can figure it out without reading 200 pages of docs
- **Feedback**: When something goes wrong, the API tells you *exactly* what happened
- **Documentation**: The spec is accurate, complete, and has examples

### WHY Does DX Matter?

APIs are products. The consumers are developers. A frustrating API:

- Increases integration time from hours to weeks
- Creates a flood of support tickets
- Forces frontend teams to write defensive code against unpredictable behavior
- Becomes a competitive disadvantage (developers will choose Stripe over your custom payment API)

### WHAT HAPPENS If You Ignore DX?

- **Integration time explodes**: A Postman 2025 survey found that **93% of API teams face collaboration blockers**, and inconsistent APIs are the #1 cause
- **Client crashes**: Mobile apps can't adapt to changing response shapes. An iOS app shipping with a hardcoded field name breaks when that field changes
- **Duplicate work**: **34% of developers can't find existing APIs** and build their own instead
- **AI unreadability**: AI agents can't consume undocumented APIs. They hallucinate parameters and endpoints

### The Three Pillars of Good API Design

```
┌─────────────────────────────────────────────────────────────┐
│                     GOOD API DESIGN                         │
├─────────────────┬───────────────────┬───────────────────────┤
│   Consistency   │   Predictability  │    Observability      │
├─────────────────┼───────────────────┼───────────────────────┤
│ Same patterns   │ Same behavior     │ Clear errors          │
│ everywhere      │ for similar ops   │ Structured logs       │
│                 │                   │ Request tracing       │
└─────────────────┴───────────────────┴───────────────────────┘
```

---

## REST API Design: The Right Way

### WHAT Is REST (Really)?

REST (Representational State Transfer) is an **architectural style**, not a protocol. Roy Fielding defined it in his 2000 doctoral dissertation with six constraints:

1. **Client-Server**: Separation of concerns
2. **Stateless**: Each request contains all necessary context
3. **Cacheable**: Responses explicitly define cacheability
4. **Uniform Interface**: Resources, representations, self-descriptive messages
5. **Layered System**: Clients can't tell if they're talking to the end server or an intermediary
6. **Code on Demand (optional)**: Servers can extend client functionality

### Richardson Maturity Model

Most "REST" APIs in the wild aren't truly RESTful. Leonard Richardson proposed four levels:

| Level | Name | Description |
|-------|------|-------------|
| 0 | The Swamp of POX | Single URL, single method (SOAP-style) |
| 1 | Resources | Multiple URLs (`/users/123`, `/orders/456`) |
| 2 | HTTP Verbs | Correct use of GET/POST/PUT/PATCH/DELETE + status codes |
| 3 | Hypermedia (HATEOAS) | Responses include links to related resources |

**The brutal truth:** Most APIs are Level 2 at best. Very few implement HATEOAS. This is fine—Level 2 is pragmatic—but understand what you're building.

### Resource Naming: Nouns, Not Verbs

#### WHAT Is the Pattern?

Resources are the nouns of your domain. Use plural nouns for collections:

```
GET    /users           # List users
GET    /users/123       # Get specific user
POST   /users           # Create user
PUT    /users/123       # Full update
PATCH  /users/123       # Partial update
DELETE /users/123       # Delete user
```

#### WHY?

HTTP methods *are* the verbs. Putting verbs in URLs is redundant:

```
GET /getUsers        # BAD - GET already means "get"
POST /createUser     # BAD - POST already means "create"
GET /users/123       # GOOD - GET + /users = "get users"
```

#### WHAT HAPPENS If You Use Verbs?

- **Inconsistent URLs**: `/getUsers`, `/fetchUser`, `/retrieveUser` all do the same thing but look different
- **Cache misses**: `GET /getUser/123` and `GET /fetchUser/123` are different cache keys for the same data
- **Breaking HTTP semantics**: A caching proxy sees `GET /deleteUser/123` and... might cache it. That's catastrophic.

#### Nested Resources

Use nesting for ownership, but don't go deeper than 2 levels:

```
GET /users/123/orders      # GOOD - orders belonging to user 123
GET /users/123/orders/456  # GOOD - specific order
GET /users/123/orders/456/items/789/shipping/tracking  # BAD - way too deep
```

For deep relationships, flatten:

```
GET /orders/456/items/789       # Better
GET /tracking?orderItemId=789   # Even better
```

### HTTP Methods Semantics

#### WHAT Are the Methods?

| Method | Safe | Idempotent | Purpose |
|--------|------|------------|---------|
| GET | Yes | Yes | Retrieve resource |
| POST | No | No | Create resource or trigger action |
| PUT | No | Yes | Full replacement of resource |
| PATCH | No | No* | Partial modification |
| DELETE | No | Yes | Remove resource |

*PATCH is idempotent only if the patch document is applied in an idempotent way (e.g., JSON Patch with test ops).

#### WHY Does PATCH vs PUT Matter?

**PUT** replaces the entire resource. If you omit a field, it disappears:

```javascript
// PUT /users/123
// Request body:
{ "name": "Alice" }

// Result: user's email, phone, preferences are GONE.
// Only name remains.
```

**PATCH** applies a partial update. Only the provided fields change:

```javascript
// PATCH /users/123
// Request body:
{ "name": "Alice" }

// Result: Only name changes. Everything else stays.
```

#### WHAT HAPPENS If You Use PUT for Partial Updates?

- **Data loss**: A frontend sends `{ name: "Alice" }` to update a name. The backend replaces the entire user. Alice loses her email, preferences, and MFA settings.
- **Race conditions**: Two clients PUT different fields concurrently. The last writer wins, silently overwriting the other's changes.
- **Client confusion**: A mobile app developer expects a partial update but watches the entire user object reset to default values.

#### Real-World Example

```javascript
// BAD: PUT used as PATCH
app.put('/api/v1/users/:id', async (req, res) => {
  const user = await db.user.update({
    where: { id: req.params.id },
    data: req.body, // Replaces ENTIRE user with req.body
  });
  res.json(user);
});

// GOOD: PUT for full replacement, PATCH for partial
app.put('/api/v1/users/:id', async (req, res) => {
  // Validate ALL required fields are present
  const { name, email, role } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({
      type: 'https://api.example.com/errors/incomplete-representation',
      title: 'Incomplete Representation',
      detail: 'PUT requires all fields: name, email, role',
    });
  }
  const user = await db.user.update({
    where: { id: req.params.id },
    data: { name, email, role },
  });
  res.json(user);
});

app.patch('/api/v1/users/:id', async (req, res) => {
  // Only update provided fields
  const user = await db.user.update({
    where: { id: req.params.id },
    data: req.body, // Prisma/SQL: SET only provided columns
  });
  res.json(user);
});
```

### Status Codes: The Complete Guide

#### WHAT Are Status Codes?

HTTP status codes are the API's way of telling the client what happened. They are standardized, machine-readable, and critical for client behavior (retry logic, caching, error handling).

#### WHY Do They Matter?

Clients implement behavior based on status codes:

- A HTTP client library sees `429` and implements exponential backoff
- A browser sees `301` and updates its bookmark
- A mobile app sees `401` and redirects to login
- A CDN sees `Cache-Control` + `200` and caches the response

#### The Essential Status Codes

| Code | Name | When to Use | When NOT to Use |
|------|------|-------------|-----------------|
| **200** | OK | Generic success | Error responses |
| **201** | Created | Resource created successfully | Updates or reads |
| **204** | No Content | Success, nothing to return (deletions, void actions) | When you have data to return |
| **400** | Bad Request | Syntax/validation error (malformed JSON, missing required field) | Business logic failures |
| **401** | Unauthorized | Authentication required or failed (no token, expired token) | Authorization failures (use 403) |
| **403** | Forbidden | Authenticated, but not authorized (insufficient permissions) | Authentication failures |
| **404** | Not Found | Resource doesn't exist | Validation errors |
| **409** | Conflict | Resource conflict (duplicate email, concurrent modification) | General errors |
| **422** | Unprocessable Entity | Semantic validation (syntactically valid but logically wrong: negative age) | Syntax errors (use 400) |
| **429** | Too Many Requests | Rate limit exceeded | General throttling |
| **500** | Internal Server Error | Unexpected server crash | Expected business errors |
| **502** | Bad Gateway | Upstream service error | Your own errors |
| **503** | Service Unavailable | Temporary overload or maintenance | Permanent failures |

#### WHAT HAPPENS If You Return 200 OK on Errors?

This is one of the most damaging anti-patterns:

```javascript
// BAD: 200 OK with error body
app.post('/api/v1/payments', async (req, res) => {
  try {
    await processPayment(req.body);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message }); // HTTP 200!!!
  }
});
```

**Consequences:**

1. **Client confusion**: HTTP clients see status 200 and call `.json()` expecting data. They get `{ success: false }` and crash trying to access `response.data.transactionId`
2. **Retry logic breaks**: A load balancer or client library sees 200 and thinks everything is fine. It doesn't retry. A transient payment failure becomes a lost transaction.
3. **Monitoring blindness**: Your uptime monitoring sees 200 and reports 100% uptime while users can't check out.
4. **Caching disasters**: A CDN caches your error response for 5 minutes because you returned 200 with `Cache-Control: max-age=300`.

**The right way:**

```javascript
// GOOD: Proper status codes with RFC 7807
app.post('/api/v1/payments', async (req, res) => {
  try {
    const payment = await processPayment(req.body);
    res.status(201).json(payment);
  } catch (err) {
    if (err instanceof InsufficientFundsError) {
      return res.status(402).json({
        type: 'https://api.example.com/errors/insufficient-funds',
        title: 'Insufficient Funds',
        status: 402,
        detail: err.message,
        balance: err.currentBalance,
        required: err.requiredAmount,
      });
    }
    if (err instanceof DuplicateTransactionError) {
      return res.status(409).json({
        type: 'https://api.example.com/errors/duplicate-transaction',
        title: 'Duplicate Transaction',
        status: 409,
        detail: 'This idempotency key has already been used',
      });
    }
    // Unexpected error - log details, send generic response
    logger.error('Payment processing failed', { error: err, body: req.body });
    res.status(500).json({
      type: 'https://api.example.com/errors/internal-error',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred. Reference: ' + req.id,
    });
  }
});
```

### Pagination: Cursor vs Offset

#### WHAT Is Offset Pagination?

```
GET /tasks?offset=20&limit=10
```

SQL implementation:
```sql
SELECT * FROM tasks ORDER BY created_at DESC OFFSET 20 LIMIT 10;
```

#### WHY Is It Popular?

- Simple to implement
- Easy to jump to "page 5"
- Works with any sort order

#### WHAT HAPPENS At Scale?

**Performance death spiral:**

```sql
-- Page 1: Fast
SELECT * FROM tasks ORDER BY created_at DESC OFFSET 0 LIMIT 10;

-- Page 100,000: Catastrophic
SELECT * FROM tasks ORDER BY created_at DESC OFFSET 1000000 LIMIT 10;
```

The database must scan and discard **1 million rows** to return 10. Time complexity: **O(offset + limit)**.

**Real-world impact:** A social media platform using offset pagination for user feeds saw `OFFSET 50000` queries taking **12+ seconds** and timing out. They switched to cursor pagination and p99 dropped to 45ms.

**Inconsistent results:** If a new task is inserted while a user is browsing, items shift between pages:

- User sees tasks [A, B, C] on page 1
- New task `Z` is inserted at the top
- User goes to page 2 and sees... `C` again (duplicate)

---

#### WHAT Is Cursor Pagination?

```
GET /tasks?cursor=eyJjcmVhdGVkQXQiOiIyMDI0LTAxLTAxVDAwOjAwOjAwWiIsImlkIjoxMjN9&limit=10
```

The cursor is an opaque (usually Base64-encoded) value representing the last seen item's sort keys.

SQL implementation:

```sql
SELECT * FROM tasks
WHERE (created_at < :last_created_at)
   OR (created_at = :last_created_at AND id < :last_id)
ORDER BY created_at DESC, id DESC
LIMIT 10;
```

#### WHY Is It Better for Large Datasets?

- **O(limit) performance**: Page 1 and page 1,000,000 execute in the same time
- **Consistent under mutation**: New insertions don't affect already-fetched items
- **No duplicates or skips**: The cursor is anchored to actual data

#### WHAT HAPPENS If You Don't Use Cursor Pagination?

- **Timeouts at scale**: Deep pages kill your database
- **User confusion**: Items appear twice or go missing as data changes
- **Cache inefficiency**: Every page is a different query; nothing is cacheable

#### Real-World Implementation

```javascript
// Cursor pagination helper
function encodeCursor(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

function decodeCursor(cursor) {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString());
  } catch {
    throw new Error('Invalid cursor');
  }
}

app.get('/api/v1/tasks', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : null;

  const tasks = await db.task.findMany({
    where: cursor ? {
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        {
          createdAt: { equals: cursor.createdAt },
          id: { lt: cursor.id },
        },
      ],
    } : undefined,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1, // Fetch one extra to check if there's more
  });

  const hasMore = tasks.length > limit;
  const data = hasMore ? tasks.slice(0, -1) : tasks;

  res.json({
    data,
    pagination: {
      next_cursor: hasMore ? encodeCursor({
        createdAt: data[data.length - 1].createdAt,
        id: data[data.length - 1].id,
      }) : null,
      has_more: hasMore,
    },
  });
});
```

**Use offset for:** Admin UIs, small datasets (< 10,000 rows), search results where jumping to page 50 is needed.
**Use cursor for:** User-facing feeds, large datasets, real-time data.

### Filtering, Sorting, Searching

#### Filtering

**Bad:** Query DSL in a string
```
GET /tasks?filter=status:active AND created_at>2024-01-01
```

**Good:** Explicit query parameters
```
GET /tasks?status=active&created_after=2024-01-01T00:00:00Z
```

**Better:** Bracket notation for operators
```
GET /tasks?status=active&due_date[lte]=2024-12-31
```

Implementation:

```javascript
const allowedFilters = ['status', 'priority', 'due_date', 'assignee_id'];
const operators = { eq: '=', gt: '>', gte: '>=', lt: '<', lte: '<=', neq: '!=' };

app.get('/api/v1/tasks', async (req, res) => {
  const where = {};

  for (const [key, value] of Object.entries(req.query)) {
    if (!allowedFilters.includes(key.split('[')[0])) continue;

    const match = key.match(/^(\w+)(?:\[(\w+)\])?$/);
    if (!match) continue;

    const [, field, op = 'eq'] = match;
    if (!operators[op]) continue;

    where[field] = { [op]: value };
  }

  const tasks = await db.task.findMany({ where });
  res.json({ data: tasks });
});
```

**Rules:**
- Whitelist filterable fields. Reject unknown filters.
- Index every filterable column.
- Document semantics: Does `name=John` mean exact match or substring?

#### Sorting

```
GET /tasks?sort=-created_at,priority
```

- `-` prefix for descending
- Comma-separated for multiple fields

```javascript
app.get('/api/v1/tasks', async (req, res) => {
  const allowedSorts = ['created_at', 'updated_at', 'priority', 'due_date'];
  const sort = (req.query.sort || '-created_at')
    .split(',')
    .map(field => {
      const desc = field.startsWith('-');
      const name = desc ? field.slice(1) : field;
      if (!allowedSorts.includes(name)) {
        throw new Error(`Cannot sort by: ${name}`);
      }
      return { [name]: desc ? 'desc' : 'asc' };
    });

  const tasks = await db.task.findMany({ orderBy: sort });
  res.json({ data: tasks });
});
```

#### Searching

**Simple (LIKE):**
```
GET /tasks?q=urgent+bug
```
→ SQL: `WHERE title ILIKE '%urgent%bug%' OR description ILIKE '%urgent%bug%'`

**Full-text (PostgreSQL):**
```sql
WHERE to_tsvector('english', title || ' ' || description)
  @@ plainto_tsquery('english', 'urgent bug')
```

**Dedicated search engine (Elasticsearch/Meilisearch):**
- Best for fuzzy matching, faceting, typo tolerance
- Async index updates via CDC or event streaming

### Idempotency: Why Payment APIs Need It

#### WHAT Is Idempotency?

An operation is idempotent if executing it multiple times has the same effect as executing it once.

| Method | Naturally Idempotent? | Why |
|--------|----------------------|-----|
| GET | Yes | Reading doesn't change state |
| PUT | Yes | Full replacement is the same every time |
| DELETE | Yes | Deleting twice = deleting once |
| POST | **No** | Each call creates a new resource |
| PATCH | Sometimes | Depends on patch semantics |

#### WHY Does It Matter?

Networks are unreliable. Clients retry requests. Without idempotency:

1. User clicks "Pay" → request times out
2. User clicks "Pay" again → **second charge**
3. User sees two $49.99 charges on their credit card

This is how you get angry customers and chargebacks.

#### WHAT HAPPENS Without Idempotency?

- **Double charges**: A payment API without idempotency keys processes retries as new payments
- **Duplicate records**: A webhook handler retries and creates two orders for the same purchase
- **Inventory corruption**: Two concurrent "deduct stock" requests oversell a product

#### Implementation: Idempotency Keys

The client generates a unique key for each logical operation. The server caches the response for that key.

```javascript
// Client sends:
POST /api/v1/payments
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

{ "amount": 4999, "currency": "usd", "source": "card_123" }
```

Server implementation with Redis:

```javascript
import { Redis } from 'ioredis';
const redis = new Redis();

async function withIdempotency(key, operation, ttl = 86400) {
  const lockKey = `idempotency:${key}`;
  const resultKey = `idempotency_result:${key}`;

  // Check if already completed
  const cached = await redis.get(resultKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Check if in-progress
  const acquired = await redis.set(lockKey, '1', 'EX', 60, 'NX');
  if (!acquired) {
    const err = new Error('Request is already being processed');
    err.status = 409;
    throw err;
  }

  try {
    const result = await operation();
    await redis.setex(resultKey, ttl, JSON.stringify(result));
    return result;
  } finally {
    await redis.del(lockKey);
  }
}

app.post('/api/v1/payments', async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return res.status(400).json({
      type: 'https://api.example.com/errors/missing-idempotency-key',
      title: 'Missing Idempotency Key',
      detail: 'POST /payments requires an Idempotency-Key header',
    });
  }

  try {
    const payment = await withIdempotency(idempotencyKey, async () => {
      return await paymentService.charge(req.body);
    });
    res.status(201).json(payment);
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({
        type: 'https://api.example.com/errors/concurrent-request',
        title: 'Concurrent Request',
        detail: 'This idempotency key is already being processed',
      });
    }
    throw err;
  }
});
```

**Rules:**
- Require `Idempotency-Key` for all mutating POST endpoints
- Scope keys to the user/API key (prevent cross-user collisions)
- Include request fingerprinting (same key + different payload = reject)
- TTL: 24 hours is standard (Stripe uses this)
- Return the same HTTP status on replay

---

## Error Handling with RFC 7807

### WHAT Is RFC 7807?

RFC 7807 defines **Problem Details for HTTP APIs** — a standard format for machine-readable error responses. It replaces the chaos of every API inventing its own error shape.

### Structure

```json
{
  "type": "https://api.example.com/errors/insufficient-funds",
  "title": "Insufficient Funds",
  "status": 402,
  "detail": "Your account does not have enough funds to complete this $49.99 purchase.",
  "instance": "/transactions/550e8400-e29b-41d4-a716",
  "balance": 12.50,
  "required": 49.99
}
```

**Required fields:**
- `type`: URI identifying the problem type (should resolve to docs)
- `title`: Short, human-readable summary (stable, don't change per occurrence)
- `status`: HTTP status code

**Optional fields:**
- `detail`: Human-readable explanation specific to this occurrence
- `instance`: URI identifying the specific occurrence

**Extension members:** Any additional domain-specific fields (e.g., `balance`, `required`)

**Content-Type:** `application/problem+json`

### WHY Use RFC 7807?

1. **Client resilience**: Generic error handlers extract `title`, `detail`, and `type` without knowing every possible error
2. **AI consumption**: AI agents need structured, typed errors to make decisions
3. **Observability**: Structured errors can be indexed and alerted on
4. **Developer experience**: Consumers know exactly where to look

### WHAT HAPPENS With Inconsistent Errors?

- **Client crashes**: Mobile apps parse `error.message` that changes from `"Not found"` to `"Resource not found"` to `"User not found"`, causing parser failures
- **Retry storms**: Without clear `Retry-After` or rate-limit error types, clients can't implement exponential backoff
- **Debugging nightmares**: Logs contain `"Something went wrong"` or `"Error code 42"` with no actionable context
- **Security leaks**: Stack traces or SQL errors exposed in production reveal internal architecture

### Express Middleware Implementation

```javascript
// errors.js
class AppError extends Error {
  constructor({ type, title, status, detail, instance, ...extensions }) {
    super(detail || title);
    this.type = type;
    this.title = title;
    this.status = status;
    this.detail = detail;
    this.instance = instance;
    this.extensions = extensions;
  }

  toJSON() {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.detail,
      instance: this.instance,
      ...this.extensions,
    };
  }
}

class ValidationError extends AppError {
  constructor(detail, errors) {
    super({
      type: 'https://api.example.com/errors/validation-failed',
      title: 'Validation Failed',
      status: 422,
      detail,
      errors,
    });
  }
}

class NotFoundError extends AppError {
  constructor(resource, id) {
    super({
      type: `https://api.example.com/errors/${resource}-not-found`,
      title: 'Resource Not Found',
      status: 404,
      detail: `${resource} with id '${id}' was not found`,
      resource,
      resourceId: id,
    });
  }
}

// Global error handler
app.use((err, req, res, next) => {
  // Log full error with context
  logger.error('Request error', {
    error: err,
    requestId: req.id,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
  });

  if (err instanceof AppError) {
    return res.status(err.status)
      .set('Content-Type', 'application/problem+json')
      .json(err.toJSON());
  }

  // Unexpected error - sanitize in production
  const isDev = process.env.NODE_ENV === 'development';
  res.status(500)
    .set('Content-Type', 'application/problem+json')
    .json({
      type: 'https://api.example.com/errors/internal-error',
      title: 'Internal Server Error',
      status: 500,
      detail: isDev ? err.message : 'An unexpected error occurred',
      ...(isDev && { stack: err.stack }),
      traceId: req.id,
    });
});
```

---

## API Versioning Strategies

### WHAT Are the Strategies?

#### 1. URL Path Versioning (Recommended)

```
GET /api/v1/users
GET /api/v2/users
```

**Pros:**
- Extremely explicit and easy to understand
- Simple to route at load balancer level
- Cache-friendly (different URLs = different cache keys)
- Easy to deprecate (stop routing to `/v1/`)
- Documentation maps cleanly to versions

**Cons:**
- Technically violates REST's "resource identification" constraint
- Can lead to code duplication

#### 2. Header Versioning

```
GET /users
API-Version: 2023-11-15
```

**Pros:**
- URLs represent pure resources
- Cleaner URLs

**Cons:**
- Harder to debug (versions not visible in URL)
- Caching proxies may ignore headers unless `Vary: API-Version` is set
- Harder to explore (can't paste URL in browser to test different version)
- Some CDNs strip custom headers

#### 3. Content Negotiation (Media-Type)

```
GET /users
Accept: application/vnd.api+json;version=2
```

**Pros:**
- Most RESTful approach per Fielding's dissertation
- Leverages HTTP content negotiation

**Cons:**
- Complex for clients
- Poor browser and tooling support
- CDN caching requires careful `Vary` configuration

### WHY Is URL Versioning Pragmatic?

It balances correctness with developer experience. It's the approach used by Stripe, GitHub, Twitter/X, and most major APIs.

### WHAT HAPPENS If You Don't Version?

**The mobile app apocalypse:**

1. You ship iOS app v1.0 that calls `GET /users` expecting `{ id, name, email }`
2. You change the endpoint to return `{ id, name, email, phone }` (seems harmless)
3. App v1.0 crashes because it serializes the response into a struct with 3 fields and the new field breaks its cache layer
4. You can't force users to update the app. They're stuck with a broken experience.
5. Your App Store rating drops from 4.8 to 2.3.

**Other consequences:**
- **Breaking changes brick clients**: Mobile apps, embedded devices, and third-party integrations break silently
- **Version hell**: Teams maintain 5+ versions because they're afraid to deprecate
- **Coordination chaos**: Every release requires synchronizing frontend, mobile, backend, and third-party teams
- **Data inconsistency**: Different versions write incompatible data formats

### Versioning Best Practices

```javascript
// Express router with versioning
import { Router } from 'express';
import { usersRouter as usersV1 } from './v1/users.routes.js';
import { usersRouter as usersV2 } from './v2/users.routes.js';

const app = express();

app.use('/api/v1', usersV1);
app.use('/api/v2', usersV2);

// Sunset headers for deprecated versions
app.use('/api/v1', (req, res, next) => {
  res.set('Sunset', '2025-12-31');
  res.set('Deprecation', 'true');
  next();
});
```

1. **Use CalVer or date-based versions** for rapidly evolving APIs: `2024-01-15` instead of `v2` (Stripe does this)
2. **Maintain versions 12–24 months** after deprecation
3. **Never remove fields without deprecation**: Mark `@deprecated` first
4. **Use OpenAPI diff tools** in CI to catch breaking changes
5. **Consumer-driven contracts**: Let consumers define expectations

---

## OpenAPI 3.1 Documentation

### WHAT Is OpenAPI 3.1?

OpenAPI (formerly Swagger) is the industry standard for describing HTTP APIs. Version 3.1 (released 2021) aligns with JSON Schema Draft 2020-12.

**Key improvements in 3.1:**
- Full JSON Schema compatibility (`type` can be `["string", "null"]`)
- `webhooks` as top-level element
- `examples` instead of `example` (multiple examples per schema)
- Improved `discriminator` for polymorphism
- License identifier without URL requirement

### WHY Does It Matter?

1. **Team collaboration**: Frontend teams mock APIs from the spec while backend implements
2. **Contract testing**: Validate that your running API matches the spec
3. **Code generation**: Generate server stubs and client SDKs
4. **AI readiness**: AI agents parse OpenAPI specs to discover and invoke APIs

### WHAT HAPPENS Without OpenAPI?

- **Documentation drift**: The docs say one thing, the API does another. Developers lose trust.
- **Integration hell**: Consumers spend hours in Slack/email trying to understand behavior
- **No automated validation**: Breaking changes slip into production
- **AI incompatibility**: Without machine-readable contracts, AI tools hallucinate endpoints

### Example OpenAPI 3.1 Spec

```yaml
openapi: 3.1.0
info:
  title: Task Management API
  version: 1.0.0
  description: |
    A RESTful API for managing tasks and projects.
  license:
    name: MIT
    identifier: MIT

servers:
  - url: https://api.example.com/api/v1
    description: Production
  - url: https://staging-api.example.com/api/v1
    description: Staging

paths:
  /tasks:
    get:
      operationId: listTasks
      summary: List tasks
      tags: [Tasks]
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [todo, in_progress, done]
          description: Filter by status
        - name: cursor
          in: query
          schema:
            type: string
          description: Pagination cursor
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
          description: Number of items per page
      responses:
        "200":
          description: List of tasks
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/TaskList"
              examples:
                standard:
                  summary: Standard response
                  value:
                    data:
                      - id: "task-123"
                        title: "Fix bug"
                        status: "in_progress"
                    pagination:
                      next_cursor: "abc123"
                      has_more: true

    post:
      operationId: createTask
      summary: Create a task
      tags: [Tasks]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateTaskInput"
      responses:
        "201":
          description: Task created
          headers:
            Location:
              schema:
                type: string
              description: URL of the created task
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Task"
        "422":
          description: Validation error
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/ProblemDetail"

  /tasks/{taskId}:
    get:
      operationId: getTask
      summary: Get a task by ID
      tags: [Tasks]
      parameters:
        - name: taskId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Task found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Task"
        "404":
          description: Task not found
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/ProblemDetail"

components:
  schemas:
    Task:
      type: object
      required: [id, title, status, createdAt, updatedAt]
      properties:
        id:
          type: string
          format: uuid
        title:
          type: string
          minLength: 1
          maxLength: 200
        description:
          type: [string, "null"]
        status:
          type: string
          enum: [todo, in_progress, done, archived]
        priority:
          type: string
          enum: [low, medium, high, urgent]
          default: medium
        dueDate:
          type: [string, "null"]
          format: date-time
        assigneeId:
          type: [string, "null"]
          format: uuid
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    CreateTaskInput:
      type: object
      required: [title]
      properties:
        title:
          type: string
          minLength: 1
          maxLength: 200
        description:
          type: string
        status:
          type: string
          enum: [todo, in_progress, done]
          default: todo
        priority:
          type: string
          enum: [low, medium, high, urgent]
          default: medium
        dueDate:
          type: string
          format: date-time
        assigneeId:
          type: string
          format: uuid

    TaskList:
      type: object
      required: [data, pagination]
      properties:
        data:
          type: array
          items:
            $ref: "#/components/schemas/Task"
        pagination:
          type: object
          required: [has_more]
          properties:
            next_cursor:
              type: [string, "null"]
            has_more:
              type: boolean

    ProblemDetail:
      type: object
      required: [type, title, status]
      properties:
        type:
          type: string
          format: uri
        title:
          type: string
        status:
          type: integer
        detail:
          type: string
        instance:
          type: string
```

### Express Integration with OpenAPI

```javascript
import { openApiValidator } from 'express-openapi-validator';

app.use(
  openApiValidator({
    apiSpec: './openapi.yaml',
    validateRequests: true,   // Validate incoming requests
    validateResponses: true,  // Validate outgoing responses (catch drift!)
  })
);
```

---

## Input Validation with Zod

### WHAT Is Zod?

Zod is a TypeScript-first schema validation library with static type inference. It validates data at runtime and generates TypeScript types.

### WHY Runtime Validation Over TypeScript Alone?

TypeScript is compile-time only. At runtime, your API receives:
- Malformed JSON from a buggy client
- Extra fields from a malicious actor
- Wrong types from a legacy integration
- `undefined` where a string is expected

**TypeScript cannot catch runtime errors.**

### WHAT HAPPENS Without Runtime Validation?

- **SQL injection**: Unvalidated strings reach your queries
- **Type confusion**: `req.body.age` is `"25"` (string) but your code does `age + 5` → `"255"`
- **Missing fields**: `req.body.email` is undefined, but you call `.toLowerCase()` → crash
- **Data corruption**: Extra fields get passed to `prisma.user.create()` and silently ignored or stored

### Zod in Practice

```javascript
import { z } from 'zod';

// Define schema
const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done']).default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
});

// Infer TypeScript type
type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
// Equivalent to:
// type CreateTaskInput = {
//   title: string;
//   description?: string;
//   status: 'todo' | 'in_progress' | 'done';
//   priority: 'low' | 'medium' | 'high' | 'urgent';
//   dueDate?: string | null;
//   assigneeId?: string | null;
// }

// Validate
app.post('/api/v1/tasks', async (req, res, next) => {
  const result = CreateTaskSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(422)
      .set('Content-Type', 'application/problem+json')
      .json({
        type: 'https://api.example.com/errors/validation-failed',
        title: 'Validation Failed',
        status: 422,
        detail: 'The request body contains invalid data',
        errors: result.error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
  }

  const task = await taskService.create(result.data);
  res.status(201).location(`/api/v1/tasks/${task.id}`).json(task);
});
```

### Advanced Zod Patterns

```javascript
// Coercion (string "25" → number 25)
const QuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

// Transforms
const DateSchema = z.string().datetime().transform((str) => new Date(str));

// Refinements (custom validation)
const TaskSchema = z.object({
  title: z.string(),
  dueDate: z.string().datetime().optional(),
}).refine(
  (data) => !data.dueDate || new Date(data.dueDate) > new Date(),
  { message: 'Due date must be in the future', path: ['dueDate'] }
);

// Reusable patterns
const UUID = z.string().uuid();
const PaginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});
```

---

## When to Choose GraphQL over REST

### WHAT Is GraphQL?

GraphQL is a query language and runtime for APIs. Unlike REST's multiple endpoints, GraphQL exposes a **single endpoint** (`/graphql`) where clients request exactly the data they need.

```graphql
query GetUserWithTasks($userId: ID!) {
  user(id: $userId) {
    id
    name
    email
    tasks(status: IN_PROGRESS, first: 5) {
      edges {
        node {
          id
          title
          priority
        }
      }
    }
  }
}
```

### WHY Choose GraphQL?

1. **Multiple clients with different needs**: Mobile app needs lightweight responses; web dashboard needs rich data
2. **Rapidly evolving frontends**: Frontend teams add fields without asking backend for new endpoints
3. **Aggregating microservices**: GraphQL gateway stitches services into a unified schema
4. **Strong typing**: The schema is a contract; breaking changes are detectable with tooling

### The N+1 Problem

**WHAT Is It?**

A query requests 100 users, and each user's `tasks` field resolves independently. Without optimization:

- 1 query for users
- 100 queries for tasks (one per user)
- **101 total queries**

**WHY Does It Happen?**

GraphQL resolves each field independently. The resolver for `user.tasks` doesn't know about other users being fetched.

**WHAT HAPPENS Without DataLoader?**

Your database is overwhelmed. A single GraphQL request becomes a query stampede. At scale, this takes down your database.

**Solution: DataLoader**

```javascript
import DataLoader from 'dataloader';

// Batch function: called once per tick with all keys
const taskLoader = new DataLoader(async (userIds) => {
  const tasks = await db.task.findMany({
    where: { userId: { in: userIds } },
  });

  // Return tasks grouped by userId
  const tasksByUser = new Map();
  for (const task of tasks) {
    if (!tasksByUser.has(task.userId)) {
      tasksByUser.set(task.userId, []);
    }
    tasksByUser.get(task.userId).push(task);
  }

  return userIds.map(id => tasksByUser.get(id) || []);
});

// In resolver
const resolvers = {
  User: {
    tasks: (user) => taskLoader.load(user.id),
  },
};
```

DataLoader:
1. Collects all `load()` calls in a single event loop tick
2. Batches them into `SELECT * FROM tasks WHERE userId IN (1,2,3...)`
3. Caches results per request (deduplicates repeated loads)

### GraphQL Best Practices

- **Always use DataLoader** for N+1 prevention
- **Implement query cost analysis** (reject expensive queries)
- **Use persisted queries** for public APIs (only accept pre-approved query hashes)
- **Depth limiting**: Cap query depth (max 7 levels)
- **Return partial errors**: `{ data: { ... }, errors: [{ ... }] }`

### When to Stick with REST

- Public third-party APIs (universal accessibility)
- Heavy caching needs (HTTP caching is mature)
- File uploads (multipart is non-standard in GraphQL)
- Simple CRUD operations where over-fetching isn't a problem

---

## tRPC: Full-Stack TypeScript APIs

### WHAT Is tRPC?

tRPC lets you build type-safe APIs without schemas, code generation, or contract files. You define your router in the backend, and your frontend gets full autocomplete for every endpoint.

```typescript
// server/router.ts
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

export const appRouter = t.router({
  user: t.router({
    getById: t.procedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => {
        return db.user.findById(input.id);
      }),
  }),
});

// Front-end gets full types automatically
// client.user.getById.useQuery({ id: '123' })
```

### WHY tRPC?

1. **End-to-end type safety:** Change a field in the backend, TypeScript catches every frontend usage
2. **No code generation:** Types flow through the import graph — no `npm run generate`
3. **Native feeling:** Calling an API feels like calling a function
4. **Smaller payloads:** tRPC uses HTTP effectively; no GraphQL query overhead

### When to Choose tRPC

| Scenario | Recommendation |
|----------|---------------|
| Full-stack TypeScript (Next.js, React + Node) | **tRPC** — seamless DX |
| Public API consumed by external teams | **REST/OpenAPI** — universal |
| Mobile app + web app | **REST/GraphQL** — tRPC is TS-only |
| Microservices across languages | **REST/gRPC** — language-agnostic |

---

## gRPC: High-Performance Internal APIs

### WHAT Is gRPC?

gRPC is a high-performance RPC framework using Protocol Buffers (protobuf) for serialization and HTTP/2 for transport. It's language-agnostic and excellent for internal microservices.

```protobuf
// service.proto
syntax = "proto3";

service TaskService {
  rpc GetTask (GetTaskRequest) returns (Task);
  rpc ListTasks (ListTasksRequest) returns (stream Task);
}

message GetTaskRequest {
  string id = 1;
}

message Task {
  string id = 1;
  string title = 2;
  string status = 3;
}
```

```typescript
// Server
const server = new grpc.Server();
server.addService(TaskServiceService, {
  getTask: (call, callback) => {
    const task = db.findTask(call.request.id);
    callback(null, task);
  },
});

// Client
const client = new TaskServiceClient('tasks.internal:50051');
client.getTask({ id: 'task-123' }, (err, response) => {
  console.log(response.title);
});
```

### WHY gRPC?

1. **Performance:** Protobuf is 5-10x smaller and faster than JSON
2. **Streaming:** Native support for bidirectional streaming
3. **Code generation:** Generate clients and servers in 10+ languages
4. **HTTP/2:** Multiplexing, header compression, binary protocol

### When to Choose gRPC

- Internal microservices (same datacenter/VPC)
- High-throughput, low-latency APIs
- Polyglot environments (Go, Rust, Python, Java, Node.js)
- Real-time streaming (telemetry, logs, chat)

### When NOT to Choose gRPC

- Public APIs (browsers don't support gRPC natively — use gRPC-Web or REST)
- Simple CRUD where JSON is "good enough"
- Debugging with `curl` (protobuf is not human-readable)

---

## REST Is Not the Only Way

### The Modern API Landscape

```
┌─────────────────────────────────────────────────────────────┐
│                    API STYLE DECISION TREE                   │
├─────────────────────────────────────────────────────────────┤
│ Public API / Mobile / Third-party? → REST + OpenAPI         │
│ Full-stack TypeScript (Next.js)?   → tRPC                   │
│ Multiple clients, evolving frontend? → GraphQL              │
│ Internal microservices, high perf?  → gRPC                  │
│ Serverless / Edge functions?        → REST or tRPC          │
└─────────────────────────────────────────────────────────────┘
```

### Fair Comparison

| Factor | REST | GraphQL | tRPC | gRPC |
|--------|------|---------|------|------|
| Type safety | OpenAPI codegen | Schema | Native (TS) | Protobuf codegen |
| Caching | Excellent (HTTP) | Custom (Apollo) | HTTP | Limited |
| Debugging | `curl` | GraphQL Playground | DevTools | grpcurl |
| Browser support | Native | Native | Native | Requires proxy |
| Cross-language | Universal | Universal | TypeScript only | Universal |
| Performance | Good | Medium | Good | Excellent |
| Learning curve | Low | High | Low | Medium |

**The pragmatic rule:** Use what fits your team and architecture. REST is not outdated. GraphQL is not a silver bullet. tRPC is magical for TypeScript monorepos. gRPC is unbeatable for internal service meshes.

---

## Real-World Consequences of Getting It Wrong

### Case Study 1: The Payment API That Double-Charged

A fintech startup didn't implement idempotency keys. A mobile client's retry logic triggered on network timeouts. Users were charged 2-3x for single purchases. The company:
- Refunded $340K in duplicate charges
- Lost their payment processor partnership
- Took 6 months to rebuild trust

**Lesson:** Idempotency isn't optional for financial operations.

### Case Study 2: The E-Commerce Site That Cached Errors

An e-commerce API returned `200 OK` with `{ error: "Out of stock" }` for inventory checks. Their CDN cached these responses for 5 minutes. During a flash sale:
- Users saw "Out of stock" for available items
- The inventory system showed stock, but the API returned cached errors
- Revenue loss estimated at $2M in a single day

**Lesson:** Status codes have semantic meaning. Don't lie to HTTP.

### Case Study 3: The Mobile App Brick

A SaaS company changed `GET /users` to return nested `profile` data instead of flat fields. They didn't version the change. Their iOS app expected flat fields and crashed on launch. It took 3 days to get an app store update approved. During that time:
- 40% of iOS users couldn't use the app
- The company had to roll back the API change
- They implemented URL versioning the next week

**Lesson:** Mobile apps can't be updated instantly. Version everything.

---

## Mini Project: Task Management API

Build a complete Task Management API with full REST conventions.

### Features

- CRUD operations for tasks
- Cursor-based pagination
- Filtering by status, priority, assignee
- Sorting by created_at, priority, due_date
- Zod validation on all inputs
- RFC 7807 error responses
- OpenAPI 3.1 documentation
- Idempotency keys for task creation

### Project Structure

```
task-api/
├── src/
│   ├── app.js                 # Express app setup
│   ├── routes/
│   │   └── tasks.routes.js    # Route definitions
│   ├── services/
│   │   └── tasks.service.js   # Business logic
│   ├── validators/
│   │   └── tasks.schema.js    # Zod schemas
│   ├── errors/
│   │   └── AppError.js        # Error classes
│   └── middleware/
│       ├── errorHandler.js    # Global error handler
│       ├── validate.js        # Zod validation middleware
│       └── idempotency.js     # Idempotency middleware
├── openapi.yaml               # OpenAPI 3.1 spec
├── package.json
└── README.md
```

### Core Implementation

```javascript
// src/validators/tasks.schema.js
import { z } from 'zod';

export const TaskStatus = z.enum(['todo', 'in_progress', 'done', 'archived']);
export const TaskPriority = z.enum(['low', 'medium', 'high', 'urgent']);

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  status: TaskStatus.default('todo'),
  priority: TaskPriority.default('medium'),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
});

export const UpdateTaskSchema = CreateTaskSchema.partial();

export const TaskQuerySchema = z.object({
  status: TaskStatus.optional(),
  priority: TaskPriority.optional(),
  assigneeId: z.string().uuid().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  sort: z.string().default('-created_at'),
});

// src/errors/AppError.js
export class AppError extends Error {
  constructor({ type, title, status, detail, ...extensions }) {
    super(detail || title);
    this.type = type;
    this.title = title;
    this.status = status;
    this.detail = detail;
    this.extensions = extensions;
  }

  toJSON() {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.detail,
      ...this.extensions,
    };
  }
}

export class ValidationError extends AppError {
  constructor(errors) {
    super({
      type: 'https://api.example.com/errors/validation-failed',
      title: 'Validation Failed',
      status: 422,
      detail: 'The request contains invalid data',
      errors,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(id) {
    super({
      type: 'https://api.example.com/errors/task-not-found',
      title: 'Task Not Found',
      status: 404,
      detail: `Task with id '${id}' was not found`,
      taskId: id,
    });
  }
}

// src/middleware/validate.js
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return next(new ValidationError(errors));
  }
  req.validatedBody = result.data;
  next();
};

// src/middleware/errorHandler.js
import { AppError } from '../errors/AppError.js';

export const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.status)
      .set('Content-Type', 'application/problem+json')
      .json(err.toJSON());
  }

  console.error('Unexpected error:', err);
  res.status(500)
    .set('Content-Type', 'application/problem+json')
    .json({
      type: 'https://api.example.com/errors/internal-error',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred',
      traceId: req.id,
    });
};

// src/services/tasks.service.js
import { NotFoundError } from '../errors/AppError.js';

// In-memory store for demo (replace with Prisma in production)
const tasks = new Map();
let idCounter = 1;

export function encodeCursor(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

export function decodeCursor(cursor) {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString());
}

export const taskService = {
  async create(data) {
    const task = {
      id: `task-${idCounter++}`,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tasks.set(task.id, task);
    return task;
  },

  async findById(id) {
    const task = tasks.get(id);
    if (!task) throw new NotFoundError(id);
    return task;
  },

  async list(filters) {
    let result = Array.from(tasks.values());

    if (filters.status) result = result.filter(t => t.status === filters.status);
    if (filters.priority) result = result.filter(t => t.priority === filters.priority);
    if (filters.assigneeId) result = result.filter(t => t.assigneeId === filters.assigneeId);

    // Sorting
    const sortFields = filters.sort.split(',');
    result.sort((a, b) => {
      for (const field of sortFields) {
        const desc = field.startsWith('-');
        const key = desc ? field.slice(1) : field;
        const cmp = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
        if (cmp !== 0) return desc ? -cmp : cmp;
      }
      return 0;
    });

    // Cursor pagination
    if (filters.cursor) {
      const cursor = decodeCursor(filters.cursor);
      const idx = result.findIndex(t => t.id === cursor.id);
      if (idx !== -1) result = result.slice(idx + 1);
    }

    const limit = filters.limit;
    const hasMore = result.length > limit;
    const data = hasMore ? result.slice(0, limit) : result;

    return {
      data,
      pagination: {
        next_cursor: hasMore ? encodeCursor({ id: data[data.length - 1].id }) : null,
        has_more: hasMore,
      },
    };
  },

  async update(id, data) {
    const task = tasks.get(id);
    if (!task) throw new NotFoundError(id);
    const updated = { ...task, ...data, updatedAt: new Date().toISOString() };
    tasks.set(id, updated);
    return updated;
  },

  async delete(id) {
    if (!tasks.has(id)) throw new NotFoundError(id);
    tasks.delete(id);
  },
};

// src/routes/tasks.routes.js
import { Router } from 'express';
import { taskService } from '../services/tasks.service.js';
import { validate } from '../middleware/validate.js';
import { CreateTaskSchema, UpdateTaskSchema, TaskQuerySchema } from '../validators/tasks.schema.js';

const router = Router();

// POST /api/v1/tasks
router.post('/', validate(CreateTaskSchema), async (req, res, next) => {
  try {
    const task = await taskService.create(req.validatedBody);
    res.status(201)
      .location(`/api/v1/tasks/${task.id}`)
      .json(task);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tasks
router.get('/', async (req, res, next) => {
  try {
    const filters = TaskQuerySchema.parse(req.query);
    const result = await taskService.list(filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tasks/:id
router.get('/:id', async (req, res, next) => {
  try {
    const task = await taskService.findById(req.params.id);
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/tasks/:id
router.patch('/:id', validate(UpdateTaskSchema), async (req, res, next) => {
  try {
    const task = await taskService.update(req.params.id, req.validatedBody);
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/tasks/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await taskService.delete(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

// src/app.js
import express from 'express';
import tasksRouter from './routes/tasks.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
app.use(express.json());

app.use('/api/v1/tasks', tasksRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

export default app;
```

### Running the API

```bash
# Initialize project
npm init -y
npm install express zod
npm install -D nodemon

# Add to package.json
# "type": "module",
# "scripts": { "start": "node src/app.js", "dev": "nodemon src/app.js" }

# Start server
node -e "import('./src/app.js').then(({default: app}) => app.listen(3000, () => console.log('Server on http://localhost:3000')))"
```

### Testing the API

```bash
# Create a task
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix critical bug","priority":"high","status":"todo"}'

# List tasks with filtering
curl "http://localhost:3000/api/v1/tasks?status=todo&priority=high&limit=2"

# Get task by ID
curl http://localhost:3000/api/v1/tasks/task-1

# Update task (PATCH for partial update)
curl -X PATCH http://localhost:3000/api/v1/tasks/task-1 \
  -H "Content-Type: application/json" \
  -d '{"status":"in_progress"}'

# Delete task
curl -X DELETE http://localhost:3000/api/v1/tasks/task-1

# Try invalid data (should get RFC 7807 error)
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":""}'
```

---

## Summary

| Concept | WHAT | WHY | WHAT HAPPENS IF WRONG |
|---------|------|-----|----------------------|
| **Resource naming** | Nouns (`/users`), plural, max 2-level nesting | HTTP methods are the verbs | Inconsistent URLs, cache misses, broken semantics |
| **PATCH vs PUT** | PUT replaces whole resource; PATCH updates fields | Prevents accidental data loss | Fields silently deleted, race conditions, client confusion |
| **Status codes** | Standardized HTTP response codes | Clients implement retry, caching, error handling based on them | Retry storms, caching errors, monitoring blindness, client crashes |
| **Cursor pagination** | Opaque cursor anchoring to last seen item | O(limit) performance, consistent under mutation | Timeouts at scale, duplicate items, skipped records |
| **Idempotency keys** | Unique key for logical operations, cached response | Networks retry; without it, operations execute multiple times | Double charges, duplicate records, inventory corruption |
| **RFC 7807 errors** | Standardized `application/problem+json` format | Machine-readable, consistent error handling | Client crashes, retry storms, security leaks, debugging nightmares |
| **URL versioning** | `/api/v1/`, `/api/v2/` | Mobile apps can't update instantly | Client breakage, version hell, coordination chaos |
| **OpenAPI 3.1** | Machine-readable API contract | Collaboration, code generation, contract testing, AI readiness | Documentation drift, integration hell, breaking changes |
| **Zod validation** | Runtime schema validation with type inference | TypeScript is compile-time only | SQL injection, type confusion, crashes, data corruption |
| **GraphQL DataLoader** | Batches N+1 queries into single query | Prevents database stampede | Production outages, database overload, timeouts |

---

## Further Reading

- [RFC 7807 - Problem Details for HTTP APIs](https://tools.ietf.org/html/rfc7807)
- [OpenAPI 3.1 Specification](https://spec.openapis.org/oas/v3.1.0)
- [Zod Documentation](https://zod.dev/)
- [Fielding's REST Dissertation](https://www.ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm)
- [Stripe API Design Guide](https://stripe.com/docs/api)
- [GitHub REST API Documentation](https://docs.github.com/en/rest)
- [Postman State of the API Report 2025](https://www.postman.com/state-of-api/)
