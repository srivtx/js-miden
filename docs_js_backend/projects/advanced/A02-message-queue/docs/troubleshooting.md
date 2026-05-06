# Troubleshooting

## Messages Lost After Restart

**Symptom:** Queue is empty after server restart.

**Cause:** In-memory storage only.

**Fix:** Implement persistence:
```typescript
class PersistentQueue {
  async enqueue(msg: Message) {
    await this.wal.append(msg);
    this.memory.push(msg);
  }
  
  async recover() {
    const logs = await this.wal.readAll();
    this.memory = logs.map(parseMessage);
  }
}
```

## Double Delivery

**Symptom:** Same message processed multiple times.

**Cause:** Ack lost, message redelivered.

**Fix:**
- Idempotent consumers
- Deduplication by message ID
- At-least-once is expected behavior

## Out of Order Messages

**Symptom:** Messages processed in wrong order.

**Cause:** Consumer takes any visible message.

**Fix:**
```typescript
// Always take index 0 (oldest)
const message = queue.messages[0];
if (message.visibleAt <= now) {
  return message;
}
```
