# Red Team: Header Attacks

---

## Attack 1: Case Variation

`x-auth-token`, `X-Auth-Token`, `X-AUTH-TOKEN` — bypass case-sensitive checks.

---

## Attack 2: Duplicate Headers

Send same header twice. Different parsers handle differently.

---

## Attack 3: Header Injection

Inject newline in header value to add fake headers.
