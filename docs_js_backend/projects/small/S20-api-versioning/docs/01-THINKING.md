# 01-THINKING.md

## Design Thinking: APIs as Contracts

An API is a legal contract between a provider and consumers. Breaking it is like changing the terms of a signed agreement without telling the other party.

### The Compatibility Mindset

```
WRONG: "We'll just update all clients at the same time"
  Reality: You have 47 client integrations.
  12 are maintained by external vendors.
  3 are embedded in hardware that can't be OTA updated.
  1 is a government contract with 18-month release cycles.
  
  "Same time" = never.

RIGHT: "Old versions live forever (or until properly sunset)"
  v1: Supported until 2026-12-31 (announced 2024-01-01)
  v2: Supported until 2028-12-31
  v3: Latest, recommended for new integrations
```

### Versioning Strategy Thinking

**URL Path Versioning**:
```
GET /v1/users
GET /v2/users

Pros: Visible, explicit, easy to route, cache-friendly
Cons: Clutters URL, represents resource versions not API versions
```

**Header Versioning**:
```
GET /users
Accept: application/vnd.api.v1+json

Pros: Clean URLs, RESTful, content negotiation
Cons: Harder to debug, caching complexity, less discoverable
```

**Query Parameter Versioning**:
```
GET /users?api-version=1

Pros: Simple, optional (default to latest)
Cons: Easy to miss, not standard, cache fragmentation
```

**Date-Based Versioning (Stripe)**:
```
Stripe-Version: 2022-11-15

Pros: Granular, release-date meaningful
Cons: Many versions to maintain, harder for developers to remember
```

### Backward Compatibility Rules

```
SAFE (Backward Compatible):
  + Adding a new optional field
  + Adding a new endpoint
  + Relaxing validation (accepting more input formats)
  + Adding enum values
  
UNSAFE (Breaking Change):
  - Removing a field
  - Renaming a field
  - Changing a field type
  - Making an optional field required
  - Changing error response format
  - Removing enum values
  - Changing default behavior
```

### Deprecation Thinking

```
WRONG: "v1 is deprecated" (no timeline, no migration guide)
  Result: Clients panic. Some migrate immediately with bugs.
  Others ignore it. On shutdown day, everything breaks.

RIGHT: Structured deprecation lifecycle
  Phase 1 (Months 0-3): Announce deprecation in changelog, email, docs
  Phase 2 (Months 3-6): Add Deprecation + Sunset headers to v1 responses
  Phase 3 (Months 6-9): Increase warning frequency, offer migration support
  Phase 4 (Months 9-12): v1 returns 410 Gone with migration link
  
  Total runway: 12 months minimum for public APIs
```

### Transformation Layer Thinking

```
Canonical Model (Database):
  { id, firstName, lastName, email, createdAt }

v1 Response:
  { id, name: `${firstName} ${lastName}`, email }

v2 Response:
  { id, firstName, lastName, email, createdAt }

v3 Response (future):
  { id, firstName, lastName, email, createdAt, profileUrl }

The database stores ONE shape. Transformations generate version-specific responses.
```
