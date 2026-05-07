# Three Wrong Ways to Handle Request IDs

---

## Wrong #1: No Request ID

No tracing. No correlation. Impossible to debug.

---

## Wrong #2: Client-Generated

Client sends request ID. Attacker can send duplicates or guessable IDs.

---

## Wrong #3: Not Propagated

Request ID exists at gateway but not passed to services. Breaks tracing.
