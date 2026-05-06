# 00-PROBLEM

## WHAT
Build a URL shortening service (bit.ly clone) that generates short codes, supports custom aliases, enforces expiration, tracks analytics, and rate-limits creation per IP.

## WHY
Short links improve UX in constrained contexts (SMS, Twitter). They also create a single point of tracking and can be used for phishing if not secured. Predictable short codes expose private links to enumeration attacks.

## Constraints
- Short codes must be unique.
- Redirects must be fast (< 10ms DB lookup).
- Analytics must not slow down redirects (fire-and-forget or async).
- Rate limit: 10 creates per IP per minute.
