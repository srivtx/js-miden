# MD06 Billing Engine — v6 Switch to ESM

> **Motto**: CommonJS is a liability; ESM is the standard.

## What Changed

Converted the entire codebase from CommonJS (`require`, `module.exports`) to ESM (`import`, `export`). Updated `tsconfig.json` to `"module": "NodeNext"`, renamed imports to include `.js` extensions, and switched the Stripe SDK to its ESM build.

## Why

- **Tree-shaking**: Stripe SDK v12+ drops 30% of bundle size under ESM
- **Top-level await**: `await stripe.webhookEndpoints.list()` in module scope for health checks
- **Future-proof**: Node.js 20+ treats ESM as first-class; CommonJS is legacy

## Architecture

No architecture change — same boxes, better wires.

## Code

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

```json
// package.json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest"
  }
}
```

```typescript
// src/utils/stripe.ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// src/services/billingService.ts
import { stripe } from '../utils/stripe.js';   // <-- .js extension required
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class BillingService {
  async createStripeCustomer(userId: string, email: string, name?: string) {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: { userId },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });
    return customer;
  }
  // ...
}

export const billingService = new BillingService();
```

## Decisions

**Option A: Keep CommonJS, use dynamic import for ESM-only deps**
- Pros: Zero migration cost
- Cons: Fragmented codebase, loses top-level await

**Option B: Full ESM migration**
- Pros: Clean, consistent, future-proof
- Cons: Must add `.js` extensions to all relative imports; some older tools break

**Chosen: B** — the project is medium-sized; migration took 30 minutes with find/replace.

## Problems We Accepted

- Some `@types/*` packages assume CommonJS; needed to update `tsconfig.json` `esModuleInterop`
- `__dirname` no longer exists; replaced with `fileURLToPath(import.meta.url)`
- Vitest config needed `globals: false` to avoid CJS interop issues

## Checklist

- [ ] `"type": "module"` is in `package.json`
- [ ] All relative imports end with `.js`
- [ ] `tsconfig.json` uses `"module": "NodeNext"`
- [ ] No `require()` or `module.exports` remains in `src/`
- [ ] Tests pass under ESM (vitest handles this natively)

## Next Step

Production setup: webhooks, idempotency, state machines, dunning, and PCI compliance.
