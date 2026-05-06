# Phase 2-3: Advanced Considerations

## Phase 2: Durability

### Message Persistence
```typescript
// Append-only log
async function persistMessage(queue: string, msg: Message) {
  const segment = getCurrentSegment(queue);
  await fs.appendFile(segment, serialize(msg));
  await fs.appendFile(segment + '.index', `${msg.id},${offset}\n`);
}
```

### Consumer Acknowledgments
- At-least-once: require ack, redeliver on timeout
- At-most-once: fire and forget
- Exactly-once: idempotent consumers + deduplication

### Redelivery Strategy
- First failure: immediate retry
- Second failure: 5 second delay
- Third failure: 30 second delay
- Dead letter queue after 3 attempts

## Phase 3: Scale

### Message Ordering
- Per-queue FIFO: single partition
- Per-key ordering: partition by key hash
- Global ordering: single partition (bottleneck)

### Replication
- Leader-follower for each queue
- Synchronous replication for durability
- Asynchronous for performance

### Compaction
- Keep latest message per key
- Delete old messages after retention period
- Similar to Kafka log compaction
