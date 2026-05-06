# M20 Webhook Receiver — v7 Production Setup

## Connect to src/

This is the final state. All evolutions converge into a clean, production-ready structure.

### Directory Structure

```
M20-webhook-receiver/
├── src/
│   ├── index.ts           # Express routes
│   ├── webhook.ts         # Safe webhook processing
│   └── webhook.buggy.ts   # Intentionally buggy (for comparison)
├── tests/
│   └── app.test.ts        # Vitest + supertest
├── evolution_docs/        # This documentation
├── package.json
├── tsconfig.json
└── dist/                  # Compiled JS (gitignored)
```

### Key Production Decisions

**1. Raw Body for Signature Verification**

```ts
app.use(express.raw({ type: 'application/json', limit: '1mb' }));
```

HMAC signatures are computed on raw bytes. If you use `express.json()`, parsing and re-stringifying may change whitespace or key ordering. Raw body preserves the exact bytes the provider signed.

**2. Timing-Safe Signature Comparison**

```ts
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    crypto.timingSafeEqual(Buffer.from(a.padEnd(b.length, '0')), Buffer.from(b.padEnd(a.length, '0')));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
```

Standard string comparison (`===`) short-circuits on the first mismatch. An attacker can measure response times to guess the signature byte-by-byte. `crypto.timingSafeEqual` always takes the same time regardless of mismatch position.

**3. Async Acknowledgment Pattern**

```ts
// Acknowledge immediately
res.status(202).json({ success: true, eventId, processed: false });

// Process asynchronously
processEventAsync(provider, eventId, payload, headers);
```

Webhook providers (GitHub, Stripe) require fast responses. If you process synchronously and timeout, they retry. Retries + sync processing = duplicate work and data corruption.

**4. Replay Protection (Stripe)**

```ts
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
const timestamp = parseInt(elements['t'] || '0', 10);
const now = Math.floor(Date.now() / 1000);
if (now - timestamp > MAX_AGE_MS / 1000) {
  return { valid: true, eventId: elements['t'] || 'unknown', tooOld: true };
}
```

Old webhook payloads are rejected. An attacker can't capture and replay a webhook from yesterday.

**5. Idempotency via Event Tracking**

```ts
const processedEvents = new Set<string>();

if (verified.duplicate) {
  return res.status(200).json({ success: true, message: 'Already processed' });
}

processEventAsync(provider, eventId, payload, headers);
```

Duplicate event IDs are ignored. Provider retries don't cause double-processing.

**6. Generic Error Responses**

```ts
} catch (err: any) {
  console.error('Webhook error:', err);
  res.status(500).json({ error: 'Internal server error' });
}
```

Never leak stack traces, secret names, or internal paths to webhook callers.

### Evolution Summary

| Version | Pain | Fix |
|---------|------|-----|
| v1 | Forged webhooks, sync timeouts, replays, duplicates | Wrote naive JS |
| v2 | Raw body vs parsed JSON confusion | Added TypeScript |
| v3 | No signature verification, no replay protection | Added HMAC + timestamps + dedup |
| v4 | Silent failures in production | Added structured logging |
| v5 | Regressions on provider additions | Added vitest + supertest |
| v6 | Legacy module system | Switched to ESM |
| v7 | Disorganized project | Clean `src/` structure |

### Running the Final Version

```bash
npm install
npm run dev      # tsx watch src/index.ts
npm run build    # tsc
npm start        # node dist/index.js
npm test         # vitest run
```
