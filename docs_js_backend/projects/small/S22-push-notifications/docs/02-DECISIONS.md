# 02-DECISIONS.md

## Decision 1: Provider Simulation

**Chosen:** Mock functions `mockFcmSend()` and `mockApnsSend()` with 10ms delay.

**Alternatives:**
- **Real FCM/APNS SDKs**: Requires Google Cloud project, Apple Developer account, real device tokens. Adds cost and credential management.
- **Firebase Admin SDK**: Official Google library. Handles token validation, batching, and topics automatically. Hides the learning opportunity.
- **node-apn + fcm-node**: Community libraries. Closer to the metal but require certificate management.

**Why mock:** Demonstrates batching and validation concepts without cloud accounts or real devices. The architectural flaws are identical.

---

## Decision 2: Token Storage

**Chosen:** In-memory `Map<string, DeviceToken>`.

**Alternatives:**
- **Redis**: Fast token lookups, TTL for expiration, perfect for this use case.
- **PostgreSQL**: Durable, relational, supports complex queries ("all tokens for user X"). Slower for simple lookups.
- **DynamoDB**: Scales infinitely. Overkill for a demo.

**Why in-memory:** Self-contained. Token validation bugs are independent of storage.

---

## Decision 3: Batch API Design

**Chosen:** `POST /notifications/send-batch` accepts an array of notification objects.

**Alternatives:**
- **FCM Topics**: Subscribe tokens to topics, send to topic once. Eliminates token management but lacks per-user personalization.
- **FCM Device Groups**: Group up to 20 tokens. Deprecated by Google in favor of topics.
- **APNS Notification Identifier**: Send to specific tokens with collapse IDs. Different mental model from FCM.

**Why direct batch:** Most flexible. Shows both the naive loop and the correct batch pattern.

---

## Decision 4: Validation Strategy

**Chosen:** Length check (`20 <= token.length <= 500`) as the minimal validation.

**Alternatives:**
- **Format regex**: FCM tokens are base64-like, APNS tokens are hex. Regex can reject more bad tokens but may break on provider format changes.
- **Provider pre-validation**: Some providers offer a "dry run" or "validate only" mode. Adds latency.
- **Cryptographic signature**: Verify token was issued by the provider. Impossible without provider keys.

**Why length check:** Catches 90% of invalid tokens (empty strings, typos, truncated values) with zero external calls. Production would add regex and provider feedback loops.

---

## Decision 5: Language / Runtime

**Chosen:** TypeScript + Node.js.

**Alternatives:**
- **Go**: Goroutines make parallel sends trivial. Less ecosystem for push notification libraries.
- **Python + FastAPI**: Simple syntax. GIL limits true parallelism for CPU-bound work (not an issue for I/O-bound pushes).
- **Java**: Excellent FCM/APNS SDKs. Heavyweight for a demo.

**Why Node.js**: Native `Promise.all` demonstrates parallelization clearly. Express is universally understood.
