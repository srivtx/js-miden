# v6 — Switching to ESM

You're trying to use `stripe` SDK v12+. It's ESM-first.

```
Error [ERR_REQUIRE_ESM]: require() of ES Module stripe not supported
```

Your payment orchestrator is CommonJS. Modern SDKs are ESM. Time to switch.

## The Fix: Go All-In on ESM

```json
// package.json
{
  "type": "module"
}
```

```ts
// providers/stripe.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_KEY!, {
  apiVersion: '2023-10-16',
});

export async function charge(amount: number, currency: string, token: string) {
  return stripe.charges.create({ amount, currency, source: token });
}
```

## Why ESM?

- **Modern SDKs work** — `stripe`, `paypal-rest-sdk` (ESM builds), ESM-only packages
- **Top-level await** — clean async initialization for provider configs
- **Static analysis** — bundlers can tree-shake when you split gateway/processor/reconciliation
- **`node:` prefixes** — clear built-in vs npm imports

## Migration

- Add `"type": "module"` to `package.json`
- Use `.js` extensions in all imports
- Replace `__dirname` with `import.meta.url`

**Next:** Production setup — multiple providers, fallback, idempotency, and reconciliation.
