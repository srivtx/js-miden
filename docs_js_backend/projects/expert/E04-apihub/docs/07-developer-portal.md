# 07 - Developer Portal Service

## WHAT

The Developer Portal Service is the interface between developers and the marketplace. It handles API registration, subscription management, and webhook configuration.

**Responsibilities:**
- Register new APIs with routing definitions
- Manage API metadata and documentation URLs
- Handle consumer subscriptions to APIs
- Configure webhook endpoints for events
- Deliver webhook notifications with HMAC signatures

## WHY

### Why a Separate Portal Service?

The Portal serves two distinct user types:
- **API Developers:** Register APIs, view analytics, manage subscriptions
- **API Consumers:** Discover APIs, subscribe, manage keys

This service is UI-facing and changes frequently. Separating it from the Gateway (which is traffic-facing) allows independent deployment cycles.

### Why Webhooks?

Webhooks enable real-time integration between ApiHub and developer systems:
- **Billing:** "Invoice created" -> developer's accounting system
- **Usage:** "Threshold reached" -> developer's alerting system
- **Security:** "Key revoked" -> developer's access control system

Polling for these events is inefficient. Webhooks push data when it matters.

## HOW

### API Registration

```typescript
interface ApiRegistration {
  developerId: string;
  name: string;
  baseUrl: string;
  routes: Array<{
    path: string;
    method: string;
    description: string;
  }>;
}

// After registration, the Gateway needs to know about this API
await gatewayClient.post('/proxy/register-target', {
  apiId: newApi.id,
  baseUrl: newApi.baseUrl,
  developerId: newApi.developerId
});
```

### Subscription Flow

```
Consumer browses APIs in Portal
    |
    v
Selects API and tier
    |
    v
Portal calls Auth Service to generate key
    |
    v
Portal creates Subscription record
    |
    v
Consumer receives API key
    |
    v
Consumer makes requests to Gateway
```

### Webhook Security

```typescript
function signWebhookPayload(secret: string, payload: unknown): string {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

function verifyWebhookSignature(secret: string, payload: unknown, signature: string): boolean {
  const expected = signWebhookPayload(secret, payload);
  // Timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// Webhook delivery
const signature = signWebhookPayload(webhook.secret, payload);
await fetch(webhook.url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
    'X-Webhook-Event': event
  },
  body: JSON.stringify(payload)
});
```

## WRONG vs RIGHT

### WRONG: Synchronous Gateway Registration

```typescript
// WRONG: Portal directly modifies Gateway state
router.post('/apis/register', async (req, res) => {
  const api = await saveApi(req.body);
  
  // Tight coupling: Portal knows Gateway internals
  await gatewayClient.post('/internal/apis', api);
  
  res.json({ api });
});
```

**Why Wrong:** If Gateway is down, API registration fails. Portal has hard dependency on Gateway availability. Can't register APIs in bulk.

### RIGHT: Event-Driven Registration

```typescript
// RIGHT: Publish event, Gateway subscribes
router.post('/apis/register', async (req, res) => {
  const api = await saveApi(req.body);
  
  // Fire event to message bus
  await eventBus.publish('api.registered', {
    apiId: api.id,
    baseUrl: api.baseUrl,
    developerId: api.developerId
  });
  
  res.json({ api });
});

// Gateway independently consumes events
eventBus.subscribe('api.registered', async (event) => {
  targetApis.set(event.apiId, {
    baseUrl: event.baseUrl,
    developerId: event.developerId
  });
});
```

**Why Right:** API registration succeeds even if Gateway is temporarily down. Gateway catches up when it recovers. Bulk registration is efficient.

### WRONG: Webhook Delivery Without Retry

```typescript
// WRONG: One-shot webhook delivery
async function triggerWebhook(webhook, event, payload) {
  try {
    await fetch(webhook.url, { method: 'POST', body: JSON.stringify(payload) });
  } catch (err) {
    console.error('Webhook failed'); // Lost forever!
  }
}
```

**Why Wrong:** Network blips cause missed notifications. Developer never receives critical billing alerts.

### RIGHT: Exponential Backoff Retry

```typescript
// RIGHT: Retry with jittered exponential backoff
async function deliverWebhook(webhook, event, payload, attempt = 1) {
  const maxAttempts = 5;
  const baseDelay = 1000; // 1 second
  
  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'X-Webhook-Signature': signWebhook(webhook.secret, payload),
        'X-Webhook-Event': event
      },
      body: JSON.stringify(payload)
    });
    
    if (response.status >= 500) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    return { delivered: true };
  } catch (err) {
    if (attempt >= maxAttempts) {
      await saveToDeadLetterQueue(webhook, event, payload, err);
      return { delivered: false, reason: 'max retries exceeded' };
    }
    
    const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
    await sleep(delay);
    return deliverWebhook(webhook, event, payload, attempt + 1);
  }
}
```

**Why Right:** Temporary failures recover automatically. Jitter prevents thundering herd. Dead letter queue allows manual inspection of persistent failures.

### WRONG: No Webhook Verification

```typescript
// WRONG: Accepting webhooks without signature verification
app.post('/webhook', (req, res) => {
  const event = req.body;
  processEvent(event); // Anyone can send fake events!
  res.json({ received: true });
});
```

**Why Wrong:** Attackers can forge webhook events to manipulate developer systems. "Invoice paid" forgery could grant unauthorized API access.

### RIGHT: Mandatory Signature Verification

```typescript
// RIGHT: Always verify HMAC signature
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const event = req.body;
  
  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }
  
  const isValid = verifyWebhookSignature(WEBHOOK_SECRET, event, signature);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  processEvent(event);
  res.json({ received: true });
});
```

**Why Right:** Cryptographic proof that the event came from ApiHub. Attackers can't forge events without the secret.

### WRONG: Storing Webhook Secrets in Plaintext

```typescript
// WRONG: Webhook secrets readable in database
const webhook = await db.query('SELECT * FROM webhooks WHERE id = ?');
console.log(webhook.secret); // Anyone with DB access sees all secrets
```

**Why Wrong:** Database breach compromises all webhook endpoints. Attackers can forge signed webhooks to all developers.

### RIGHT: Hashed Webhook Secrets

```typescript
// RIGHT: Hash secrets like passwords
const secret = crypto.randomBytes(32).toString('hex');
const secretHash = hashSecret(secret);

// Store hash, return raw secret only once
await db.query('INSERT INTO webhooks (id, secret_hash) VALUES (?, ?)', [id, secretHash]);

// Verification
const isValid = verifyWebhookSignature(rawSecret, payload, signature);
// Compare against hash
const matches = await compareSecret(rawSecret, webhook.secretHash);
```

**Why Right:** Even with full database access, secrets can't be extracted. Forgery requires the original secret.
