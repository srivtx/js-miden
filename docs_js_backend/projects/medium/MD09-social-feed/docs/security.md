# Security

## Authentication

- JWT tokens with 7-day expiration
- Passwords hashed with bcrypt (10 rounds)
- Token refresh on sensitive actions

## Authorization

- Users can only modify own posts
- Follow/unfollow requires authentication
- Feed is private to each user

## Rate Limiting

- 100 requests per minute per IP
- Separate limits for posting (10/min) to prevent spam

## Data Protection

- Passwords never stored in plain text
- Content moderation for posts
- GDPR data export endpoint

## Known Vulnerabilities

1. **Blocking Fan-out**: Can be used for DoS by creating posts with many followers
2. **Offset Pagination**: Information disclosure about total post counts

## Hardening

- Input validation with Zod
- SQL injection prevention via parameterized queries
- XSS protection via output encoding
