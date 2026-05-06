# 02-DECISIONS

## Subdomain vs Header for Tenant Resolution
- **Subdomain**: User-friendly, bookmarkable, but requires DNS and TLS wildcard.
- **Header**: Flexible, works behind proxies, but less discoverable.
- **Decision**: Support both; header for API clients, subdomain for browser.

## Shared Schema vs Separate Schema
- **Shared Schema**: Easier migrations, but RLS or tenant columns are mandatory.
- **Separate Schema**: Strong isolation, simpler queries, but migration tools must iterate schemas.
- **Decision**: Separate schema for strong isolation demonstration.

## JWT vs Session Cookies
- **JWT**: Stateless, works across services, but revocation is hard.
- **Session**: Easy revocation, but requires centralized store.
- **Decision**: JWT with short expiry for stateless auth; refresh tokens in Redis for revocation.
