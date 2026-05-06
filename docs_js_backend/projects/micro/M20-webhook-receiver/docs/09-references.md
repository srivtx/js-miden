# References

## Standards & RFCs

- **RFC 2104** — HMAC: Keyed-Hashing for Message Authentication
- **FIPS PUB 198-1** — The Keyed-Hash Message Authentication Code (HMAC)
- **RFC 7234** — HTTP Caching
- **RFC 7239** — Forwarded HTTP Extension

## Provider Documentation

- **Stripe: Webhook Best Practices** — https://stripe.com/docs/webhooks/best-practices
- **Stripe: Idempotency** — https://stripe.com/docs/api/idempotent_requests
- **GitHub: Securing Your Webhooks** — https://docs.github.com/en/webhooks/using-webhooks/securing-your-webhooks
- **GitHub: Webhook Events & Payloads**

## Security Guidelines

- **OWASP Web Security Testing Guide** — Webhook & Race Condition testing
- **OWASP Input Validation Cheat Sheet**
- **OWASP Session Management Cheat Sheet**

## Libraries

- **express.raw()** — https://expressjs.com/en/api.html#express.raw
- **crypto.timingSafeEqual** — Node.js documentation
- **JSON Schema** — https://json-schema.org/
- **Ajv** — JSON Schema validator for Node.js

## Case Studies

- Bangladesh Bank / SWIFT Heist (2016) — Replay attacks in financial messaging
- Coinbase Post-Mortem (2018) — Double-credit race condition
- GitHub Partner Integration (2018) — Missing HMAC verification
- Atlassian Jira Webhook Loop (2019) — Malformed payload handling

## Research

- Fielding, R. (2000). *REST dissertation* — Idempotency definition
- OWASP: Testing for Race Conditions
