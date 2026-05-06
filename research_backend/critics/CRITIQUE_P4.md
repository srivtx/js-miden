# Critique Report: Project 4 — SaaS Billing Engine

**Reviewer:** Senior Technical Critic Agent  
**Date:** 2026-05-06  
**File Reviewed:** `/docs_js_backend/projects/04-saas-billing/README.md`

---

## Executive Summary

This project teaches the most financially dangerous domain: money. It gets the **concepts** mostly right (idempotency, state machines, webhook verification, event sourcing). But the **implementation** contains multiple critical bugs in the webhook verification, double-inserts events into the database, and has a webhook handler that is neither idempotent nor transactional. In billing, these aren't bugs—they're **regulatory violations**.

---

## CRITICAL (Will cause double-charges, revenue loss, or fraud if copied)

### C1. `verifyStripeSignature` is Broken — Will Reject Legitimate Webhooks
- **Location:** `src/webhooks/verifyStripeSignature.ts`
- **Issue:** The function splits the signature header by comma: `const elements = signature.split(',');`. Stripe's `Stripe-Signature` header format is:
  ```
  t=1492774577,v1=5257a869...,v0=...
  ```
  BUT during secret rotation, Stripe sends **multiple `v1` signatures** separated by commas:
  ```
  t=...,v1=aaa...,v1=bbb...
  ```
  The code does `elements.find(el => el.startsWith('v1='))?.split('v1=')[1]`, which only gets the FIRST `v1` signature. If the first one is the old secret and the second is the new one, verification fails against the new secret. Also, `crypto.timingSafeEqual` throws if the two buffers are different lengths. If `signatureHash` has a different hex length than `expectedSignature` (e.g., due to encoding issues), the function crashes with an uncaught exception instead of returning `false`.
- **Impact:** Legitimate webhooks are rejected during secret rotation. The app misses payment events, fails to provision accounts, and loses revenue. The uncaught exception may crash the process.
- **Fix Required:** Use Stripe's official `stripe.webhooks.constructEvent()` method. Do NOT roll your own signature verification. If you must, iterate over ALL `v1=` signatures and validate each. Also guard `timingSafeEqual` against length mismatches.

### C2. Webhook Handler Double-Inserts Into `billing_events`
- **Location:** `src/webhooks/stripeWebhook.ts`
- **Issue:** The handler calls `appendEvent({...})` (which INSERTs into `billing_events`), THEN immediately does another raw INSERT:
  ```typescript
  await db.query(
    'INSERT INTO billing_events (stripe_event_id, event_type, aggregate_type, aggregate_id, payload) VALUES (?, ?, ?, ?, ?)',
    [event.id, event.type, 'subscription', event.data?.object?.id || 'unknown', JSON.stringify(event)]
  );
  ```
  This inserts the same event **twice** (though the second might fail on the unique constraint). But wait—the unique constraint on `stripe_event_id` should prevent the second insert. However, if the first `appendEvent` doesn't include `stripe_event_id` in its insert (it doesn't show it in the snippet), or if there's a race condition between the two inserts, you get a unique constraint violation that returns 500 to Stripe, triggering a retry loop.
- **Impact:** Stripe receives 500 errors, retries webhooks, and the handler enters a thundering herd of retries and DB constraint violations.
- **Fix Required:** Remove the redundant raw INSERT. Use exactly ONE insert path. Use a transaction.

### C3. Idempotency Check is NOT a Transaction — Race Condition Enables Double-Processing
- **Location:** `src/webhooks/stripeWebhook.ts`, `src/middleware/idempotency.ts`
- **Issue:** The idempotency check is `SELECT id FROM billing_events WHERE stripe_event_id = ?`. If two identical webhooks arrive at the exact same millisecond (Stripe retries aggressively), both checks can return 0 rows before either INSERT completes. Both proceed to process the event. The unique constraint catches one, but that one gets a 500 error, causing ANOTHER retry.
- **Impact:** Double-charging, duplicate tier upgrades, and angry customers.
- **Fix Required:** The idempotency check must be an UPSERT (`INSERT ... ON CONFLICT DO NOTHING RETURNING id`) wrapped in a transaction. Only the transaction that successfully inserts should proceed.

### C4. Webhook Handler Does Not Mark Events as "Processed" — Failing Events Are Never Retried Safely
- **Location:** `src/webhooks/stripeWebhook.ts`
- **Issue:** The idempotency check looks for ANY row with the `stripe_event_id`. If the first attempt fails (throws 500), the row exists in `billing_events` but `processed_at` is NULL. The second attempt sees the row and returns 200, thinking it was already processed. But the business logic (upgrading the user) NEVER RAN.
- **Impact:** Webhooks that fail on first attempt are silently swallowed on retry. Users pay but never get upgraded.
- **Fix Required:** Add a `processing_status` column (`pending`, `processed`, `failed`). Only skip if status is `processed`. Implement exponential backoff retry for `failed` events.

### C5. `verifyStripeSignature` Called on Already-Parsed Body
- **Location:** `src/app.ts` + `src/webhooks/stripeWebhook.ts`
- **Issue:** The handler signature is:
  ```typescript
  app.use('/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler);
  ```
  But inside `stripeWebhookHandler`, it does `const event = JSON.parse(payload.toString())` BEFORE calling `verifyStripeSignature`. Wait—actually it calls verify first, then JSON.parse. But `verifyStripeSignature` takes `payload: string | Buffer`. The `signedPayload = \`${timestamp}.${payload}\`` will do string interpolation on a Buffer, which calls `.toString()` with default UTF-8. This SHOULD work, but if the raw body parser is configured with any encoding other than utf8, the signatures won't match. More importantly, the `idempotencyMiddleware` is shown using `req.body?.id`, but `express.raw()` produces a Buffer, not parsed JSON. The middleware as shown will fail because `req.body` is a Buffer and has no `id` property.
- **Impact:** Idempotency middleware doesn't work with raw body. Signature verification may fail silently due to encoding mismatches.
- **Fix Required:** Parse the Buffer inside the handler, not in middleware. Use Stripe's official SDK method `stripe.webhooks.constructEvent(req.body, sig, secret)` which handles Buffer correctly.

### C6. Missing Stripe States in State Machine
- **Location:** `src/billing/subscriptionStateMachine.ts`
- **Issue:** Stripe subscriptions can be `incomplete`, `incomplete_expired`, `paused`, and `unpaid`. The state machine only handles 5 states. A webhook with `status: incomplete` will fail validation or be treated as invalid.
- **Impact:** New subscriptions created with 3D Secure or SCA may get stuck in an unhandled state.
- **Fix Required:** Include all Stripe subscription statuses, or default to a safe "unknown" handling path.

---

## MAJOR (Outdated, inefficient, or missing robustness)

### M1. `calculateProration` is Naive and Misleading
- **Location:** `src/billing/proration.ts`
- **Issue:** The function calculates a simple daily rate. Stripe's actual proration considers plan intervals, taxes, coupons, trial days, and usage-based billing. A learner using this function to display "estimated cost" will show wrong amounts that don't match Stripe's invoice.
- **Impact:** User confusion, support tickets, potential legal issues around misleading pricing displays.
- **Fix Required:** State clearly that this is an ESTIMATE only. Always fetch the actual proration from Stripe's `invoice.upcoming` API before displaying amounts.

### M2. Webhook Handler Fetches from Stripe API Synchronously — Slow and Unreliable
- **Location:** `src/handlers/subscriptionHandler.ts`
- **Issue:** `await stripe.subscriptions.retrieve(stripeSubId)` is called inside the webhook handler. If Stripe's API is slow, the handler times out. Stripe retries. The retry hits the idempotency check (which may or may not work) and returns 200, but the first request may still be processing.
- **Impact:** Timeouts, retries, and potential deadlocks.
- **Fix Required:** Acknowledge the webhook immediately (store in queue), process asynchronously.

### M3. No Transaction Wrapping for Billing Operations
- **Location:** `src/handlers/subscriptionHandler.ts`
- **Issue:** The handler updates `subscriptions`, then updates `users`. These are two separate queries. If the app crashes between them, the subscription and user tier are out of sync.
- **Impact:** Data inconsistency. User has `tier = enterprise` but subscription is `canceled`.
- **Fix Required:** Wrap in a database transaction, or use event sourcing as the single source of truth.

### M4. SQL Schema is MySQL-Specific But Code Uses Generic `db.query`
- **Location:** `migrations/001_init.sql`
- **Issue:** `BIGINT UNSIGNED AUTO_INCREMENT`, `ON UPDATE CURRENT_TIMESTAMP`, and `ENUM` are MySQL-isms. The code uses `db.query('SELECT * FROM subscriptions WHERE stripe_subscription_id = ?', [stripeSubId])` which implies a parameterized query driver, but no driver is selected (mysql2? pg? sqlite?). The schema won't work on PostgreSQL, which the other projects use.
- **Impact:** Learners using PostgreSQL (as taught in previous projects) will get syntax errors.
- **Fix Required:** Standardize on PostgreSQL with proper syntax, or explicitly state this project requires MySQL.

### M5. `change-plan` Route Does Not Update Local DB
- **Location:** `src/routes/subscriptions.ts`
- **Issue:** The route updates Stripe but explicitly says "Don't update DB tier here! Wait for webhook." If the webhook is lost (network issue, bug, downtime), the user's local tier never changes. They paid for Pro but are still on Free.
- **Impact:** Revenue-impacting bug. The "wait for webhook" pattern is correct only if you have a reconciliation job. None is shown.
- **Fix Required:** Add a scheduled reconciliation job that syncs Stripe state to local DB every hour.

### M6. No Database Connection Pooling Shown
- **Location:** Entire guide
- **Issue:** The `db` module is never shown. Learners don't know how to configure connection limits, which is critical under webhook load.

---

## MINOR (Typos, inconsistencies, papercuts)

### m1. Inconsistent `db` Import Paths
- **Location:** Multiple files
- **Issue:** Some files import `db` from `../db`, others from `../db/client.js`.

### m2. `users.id` is `BIGINT UNSIGNED` but `stripe_customer_id` is Nullable
- **Location:** SQL schema
- **Issue:** `stripe_customer_id VARCHAR(255) UNIQUE` allows NULL, but some UNIQUE implementations in MySQL allow multiple NULLs. This is fine, but inconsistent with strictness elsewhere.

### m3. `processDunningAttempt` References Undefined Functions
- **Location:** `src/billing/dunning.ts`
- **Issue:** `reactivateSubscription`, `cancelSubscription`, `markUnpaid`, `sendEmail`, and `scheduleRetry` are called but never defined or imported.

### m4. Load Test Sends Webhooks Without Valid Signature
- **Location:** `tests/load/webhooks.js`
- **Issue:** The k6 load test sends payloads to `/webhooks/stripe` without a `Stripe-Signature` header. If signature verification is enabled, every request returns 400, making the load test useless.

---

## MISSING (Important topics not covered)

### X1. Tax Handling (Sales Tax / VAT)
- SaaS billing requires tax calculation. Stripe Tax exists but is never mentioned.

### X2. Webhook Endpoint Versioning
- Stripe API versions change. No discussion of how to handle breaking webhook payload changes.

### X3. Reconciliation Job
- Since the guide advocates "wait for webhook," it MUST provide a reconciliation cron job for when webhooks fail.

### X4. Refund Handling
- No mention of `charge.refunded` events or how to handle pro-rated refunds.

### X5. 3D Secure / SCA Flow
- European payments require Strong Customer Authentication. No mention of `payment_intent.requires_action`.

### X6. Stripe Test Clock
- Testing subscriptions with time-based events is painful. Stripe Test Clock is the standard tool but not mentioned.

---

## EDUCATIONAL QUALITY

| Aspect | Score | Notes |
|--------|-------|-------|
| Concept Introduction | A | Idempotency, state machines, webhook verification, proration, dunning are explained with excellent real-world examples. |
| Bug Design | A | All 5 bugs are financially realistic. No signature, no idempotency, race condition, missing state validation, and sync processing are all production billing failures. |
| Fix Completeness | C | The signature verification "fix" is dangerously wrong. The idempotency fix misses the race condition. The async processing fix is conceptual. |
| Production Readiness | D | Double-inserts, broken signature verification, and race conditions in idempotency make this non-deployable. |
| Copy-Paste Safety | D | A learner copying the webhook handler will create duplicate billing events and reject legitimate webhooks during secret rotation. |

### Verdict
**Strong conceptual teaching, but the implementation is a compliance liability.** The guide correctly identifies what CAN go wrong in billing, but the "correct" code contains the exact bugs it warns against (broken verification, race conditions, double-inserts). This MUST be rewritten using Stripe's official SDK methods and proper transactional idempotency patterns before learners are allowed to copy it.

---

*End of Report — P4*
