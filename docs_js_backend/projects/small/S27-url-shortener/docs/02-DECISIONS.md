# 02-DECISIONS

## Base62 vs UUID for Short Codes
- **Base62**: Compact, human-readable, can be random or sequential.
- **UUID**: Guaranteed uniqueness, but too long for a short URL.
- **Decision**: Base62 with sufficient entropy (7+ random chars). Sequential is WRONG (bug).

## PostgreSQL vs Redis for Storage
- **PostgreSQL**: Durable, relational, good for analytics joins.
- **Redis**: Ultra-fast lookups, but persistence is optional.
- **Decision**: PostgreSQL for canonical storage; Redis could cache hot redirects.

## 301 vs 302 Redirect
- **301**: Permanent, browsers cache aggressively; bad if target changes.
- **302**: Temporary, no caching; more flexible.
- **Decision**: 302 (or 307) to retain control over the destination.
