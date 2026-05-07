# Three Wrong Ways to Handle Webhooks

---

## Wrong #1: No Verification

```javascript
app.post('/webhook', (req, res) => {
  await processEvent(req.body);
});
```

**Why it's wrong:** Anyone can send fake events. Complete trust.

---

## Wrong #2: Synchronous Processing

```javascript
app.post('/webhook', async (req, res) => {
  await processEvent(req.body); // Takes 5 seconds
  res.sendStatus(200);
});
```

**Why it's wrong:**
- Webhook provider times out after 30 seconds
- If processing fails, provider retries = duplicate processing
- Blocks the HTTP connection

**Fix:** Ack immediately, process asynchronously.

---

## Wrong #3: No Idempotency

```javascript
app.post('/webhook', async (req, res) => {
  await createOrder(req.body.orderId);
});
```

**Why it's wrong:** Webhooks are retried. Same event = duplicate orders.

**Fix:** Track processed event IDs:
```javascript
if (await isProcessed(event.id)) {
  return res.sendStatus(200); // Already handled
}
await processEvent(event);
await markProcessed(event.id);
```
