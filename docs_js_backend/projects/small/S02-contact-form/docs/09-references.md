# S02 Contact Form — References

## Rate Limiting

1. **Redis Documentation — Rate Limiting Patterns**
   https://redis.io/docs/manual/patterns/distributed-locks/
   > Covers fixed window, sliding window, and token bucket implementations with Redis Lua scripts.

2. **Cloudflare — Rate Limiting Algorithms**
   https://blog.cloudflare.com/counting-things-a-lot-of-different-things/
   > Explains why Cloudflare uses both fixed and sliding windows depending on the product tier.

3. **Martin Fowler — Circuit Breaker & Bulkhead Patterns**
   https://martinfowler.com/bliki/CircuitBreaker.html
   > Related resilience patterns for handling downstream failures.

## Validation & Bot Protection

4. **`validator` npm package documentation**
   https://github.com/validatorjs/validator.js
   > Source of `isEmail()`, `normalizeEmail()`, and `escape()` behavior.

5. **OWASP — Cheat Sheet Series: Input Validation**
   https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
   > Why allow-list validation is preferred over block-list (regex) for security.

6. **NIST — Digital Identity Guidelines (SP 800-63B)**
   https://pages.nist.gov/800-63-3/sp800-63b.html
   > Recommends against overly strict email validation that rejects valid RFC addresses.

## GDPR

7. **UK ICO — Guide to the UK General Data Protection Regulation**
   https://ico.org.uk/for-organisations/guide-to-data-protection/
   > Practical guidance on lawful basis, data minimization, and retention.

8. **GDPR.eu — Data Minimization**
   https://gdpr.eu/data-minimization/
   > Explains why collecting only necessary data reduces compliance burden.

## Honeypots

9. **Project Honeypot — Bot Detection Research**
   https://www.projecthoneypot.org/
   > Community-driven data on bot behavior and IP reputation.

## Express & Node.js Security

10. **Express.js — Production Best Practices: Security**
    https://expressjs.com/en/advanced/best-practice-security.html
    > Official guide on headers, TLS, and `trust proxy` settings.

11. **Node.js Security Checklist**
    https://blog.risingstack.com/node-js-security-checklist/
    > Comprehensive checklist including rate limiting, input validation, and logging.
