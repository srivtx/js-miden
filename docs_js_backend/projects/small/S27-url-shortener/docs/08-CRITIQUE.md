# 08-CRITIQUE

## Senior Engineer Review

### What is done well
- PostgreSQL with unique constraints prevents code collision.
- Rate limiting is applied at the route level.
- Analytics are separated from the redirect hot path.

### What is risky
- No caching layer for redirects. A viral link will hammer PostgreSQL. Add Redis caching with TTL.
- No phishing or malware link scanning before shortening. Malicious URLs can damage reputation.
- Custom codes without profanity filtering can produce offensive URLs.

### What is missing
- Soft delete and audit logs for compliance.
- Preview endpoint (like bit.ly `+`) so users know where a link leads before clicking.
- API keys or authentication for link creation in production.

### The Bug
Sequential short codes are an IDOR vulnerability. In 2025, there is no excuse for predictable identifiers. Use nanoid or a CSPRNG. Also consider adding authentication to analytics endpoints so link owners only see their own stats.
