# Data Model

## Messages

```typescript
interface Message {
  id: string;           // UUID
  queueName: string;    // Target queue
  body: string;         // Payload
  headers: object;      // Metadata
  createdAt: number;    // Timestamp (ms)
  deliveryCount: number;
  visibleAt: number;    // When message becomes visible again
  ackId: string | null; // Acknowledgment token
}
```

## Queues

```typescript
interface Queue {
  name: string;
  messages: Message[];
  consumers: string[];
}
```

## Topics

```typescript
interface Topic {
  name: string;
  subscribers: string[]; // Queue names
}
```

## Storage Formats

### In-Memory (Current)
```javascript
Map<string, Queue> queues
Map<string, Topic> topics
```

### Disk Persistence (Future)
```
data/
  queues/
    my-queue/
      segment-00001.log
      segment-00002.log
      index.json
```

### Segment File Format
```
[offset:4][length:4][message_json]
[offset:4][length:4][message_json]
...
```
