# Security

## Authentication

- JWT tokens for HTTP API
- WebSocket connections validated on upgrade
- Token expiration: 24 hours

## Bid Security

- Atomic transactions prevent race conditions
- Bid validation ensures amount > current price
- All bids logged immutably

## Anti-Sniping

- Server-side time checks
- Auto-extension prevents last-second wins
- NTP synchronization required

## Data Protection

- Bid history visible to all (public auction)
- Bidder identities anonymous until close
- Payment info handled by PCI-compliant provider

## Known Vulnerabilities

1. **Race Condition**: Concurrent bids can corrupt state
2. **Invalid Bids**: Lower bids accepted without validation

## Hardening

- Database row locking (`FOR UPDATE`)
- Serializable isolation level
- Server-side time validation
- Rate limiting on bids per user
