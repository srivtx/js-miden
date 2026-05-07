# Three Wrong Ways to Validate Headers

---

## Wrong #1: Case-Sensitive

`req.headers['Content-Type']` misses `content-type`.

---

## Wrong #2: No Whitelist

Accept any header. Validate nothing.

---

## Wrong #3: Trusting Client Headers

`X-Forwarded-For`, `X-Real-IP` — all client-settable.
