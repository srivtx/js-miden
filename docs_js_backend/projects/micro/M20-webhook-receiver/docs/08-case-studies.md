# Case Studies

## Case Study 1: Bangladesh Bank / SWIFT — Replay Attack (2016)

**Incident:** Attackers compromised the Bangladesh Bank's network and sent $81M in fraudulent transfer requests via the SWIFT messaging network. The messages were valid, signed, and authenticated — they were simply replayed and reordered after the initial foothold.

**Webhook Parallel:** The receiving bank did not enforce idempotency or message-sequence validation. A valid message processed once could be replayed indefinitely.

**Lesson:** Financial and critical webhook systems must use idempotency keys, sequence numbers, and short time windows.

## Case Study 2: Coinbase Double-Credit (2018)

**Incident:** Coinbase's deposit webhook handler experienced a race condition. Two parallel workers received the same retry for a cryptocurrency deposit. Both checked for the event ID, saw it absent, and both credited the user's account.

**Root Cause:** Non-atomic idempotency check (read-then-write).

**Fix:** Database `UNIQUE` constraint on `(source, event_id)` with `INSERT ... ON CONFLICT DO NOTHING`.

## Case Study 3: GitHub Partner Integration — Missing HMAC (2018)

**Incident:** A third-party CI partner did not verify HMAC signatures on repository webhooks. An attacker who discovered the endpoint URL sent forged `push` events, triggering CI builds that exposed environment variables and internal network access.

**Lesson:** Signature verification is non-negotiable. Webhook endpoints without verification are effectively open APIs.

## Case Study 4: Atlassian Jira — Malformed Payload Loop (2019)

**Incident:** A correctly signed Jira webhook contained an empty `issue` object. A downstream consumer did not validate payload structure and entered an infinite OAuth token refresh loop, exhausting rate limits and degrading service for integrated apps.

**Lesson:** Signatures verify origin; schema validation verifies sanity. Both are required.

## Timeline: Coinbase Race Condition

```
Time ─────────────────────────────────────────────────>

Provider: ──[Webhook evt_99]──→ Retry ──[Webhook evt_99]──→
                │                           │
Worker A:   [Check DB: evt_99 missing]
                │
Worker B:                           [Check DB: evt_99 missing]
                │                           │
Worker A:   [Write credit $100]             │
                │                           │
Worker B:                           [Write credit $100]
                │                           │
Result:     $200 credited for one deposit.

Mitigation:
  - Atomic UPSERT with UNIQUE(event_id).
  - Or distributed lock (Redis Redlock) before processing.
```

## References

- SWIFT Customer Security Programme — CSCF Controls
- Coinbase Post-Mortem Blog (2018)
- GitHub Docs: Securing webhooks
- Atlassian Status Page (2019)
