# 02-DECISIONS.md

## Key Design Decisions

### Decision 1: URL Path vs Header Versioning

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **URL Path** (`/v1/users`) | Explicit, debuggable, cacheable | Clutters URLs | ✅ **CHOSEN** — Primary mechanism |
| **Accept Header** (`Accept: vnd.api.v1+json`) | Clean URLs, RESTful | Harder to debug, CDN cache complexity | ✅ **CHOSEN** — Secondary mechanism |
| Query param (`?version=1`) | Simple, optional | Non-standard, easy to forget | ❌ Not used |
| Date-based (`2024-01-15`) | Granular | Many versions, hard to communicate | ❌ Good but complex |

**Rationale**: Supporting both URL and header versioning demonstrates the tradeoffs. URL is the default for browser debugging. Headers are preferred by REST purists.

### Decision 2: Separate Routers vs Single Router with Transformation

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **Separate routers per version** | Clear separation, version-specific logic | Code duplication | ✅ **CHOSEN** — Explicit and educational |
| Single router + transformation | DRY, centralized | More complex routing logic | ❌ Good but hides version mechanics |
| Middleware-based | Flexible | Harder to trace execution | ❌ Too abstract |

**Rationale**: Separate `v1Router` and `v2Router` make it obvious which code serves which version. In production, a transformation layer might be cleaner, but this teaches the versioning concept clearly.

### Decision 3: In-Memory Data vs Database

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **In-Memory Arrays** | Zero setup, instant | Not persistent | ✅ **CHOSEN** — Focus on versioning, not persistence |
| PostgreSQL with views | Realistic, performant | Schema migrations, Docker | ❌ Distracts from API versioning |

**Rationale**: The bugs (breaking change, no deprecation) are about API contract discipline, not database design.

### Decision 4: Deprecation Communication

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **HTTP Deprecation + Sunset headers** | Standard (RFC 8594) | Not all clients check headers | ✅ **CHOSEN** — Machine-readable |
| Response body metadata | Always visible | Pollutes response payload | ❌ Good supplement |
| Documentation-only | Simple | Clients don't read docs | ❌ Insufficient |
| Email + Changelog | Human-friendly | Not automated | ❌ Good supplement |

**Rationale**: `Deprecation` and `Sunset` headers (RFC 8594) are the HTTP-standard way to communicate deprecation. Clients can programmatically detect and alert on them.

### Decision 5: Transformation Direction

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **Canonical v2 -> transform down to v1** | Latest is canonical, older are views | v1 performance cost | ✅ **CHOSEN** — Future-proof |
| Canonical v1 -> transform up to v2 | Simple for current version | v1 constraints future design | ❌ Bad long-term |
| Dual canonical | No transformation cost | Data duplication, consistency risk | ❌ Anti-pattern |

**Rationale**: The newest version should be the canonical data model. Older versions are derived views. This prevents legacy constraints from dictating future design.
