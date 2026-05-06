# 04-OLD-VS-NEW

## 2015 Patterns
- Sequential integer IDs exposed as short codes.
- No rate limiting; anyone can create unlimited links.
- No analytics or basic hit counters only.
- 301 redirects with no expiration logic.
- Single monolith with no cache layer.

## 2025 Patterns
- Cryptographically random short codes (nanoid, base62 with entropy).
- Redis-backed rate limiting per IP and per user.
- Async analytics with streaming or OLAP (ClickHouse, BigQuery).
- 302/307 redirects with expiration and soft-delete.
- CDN edge caching for popular redirects.
- Phishing detection and preview metadata generation.
