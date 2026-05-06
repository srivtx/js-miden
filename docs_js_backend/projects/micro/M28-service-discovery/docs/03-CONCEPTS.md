# 03-CONCEPTS: Service Discovery

## WHAT is Service Discovery?

Service Discovery is the mechanism by which services in a microservices architecture find and communicate with each other **without hardcoding network locations**. It is a dynamic phone book for distributed systems.

## WHY do we need it?

| Without Discovery | With Discovery |
|-------------------|----------------|
| Hardcoded IPs in config files | Services lookup addresses dynamically |
| Manual updates on every deploy | Automatic registration on startup |
| No awareness of crashes | Dead services removed via TTL |
| Scaling requires DNS changes | New instances appear instantly |

## HOW does it work?

### Lifecycle

```
┌─────────────┐    Register     ┌─────────────┐
│   Service   │────────────────▶│   Registry  │
│   Starts    │                 │   :3000     │
└─────────────┘                 └──────┬──────┘
       │                               │
       │ Heartbeat                     │ Cleanup
       │ every 1s                      │ every 1.5s
       │                               │
       └──────────────────────────────▶│
       │                               │
       │ (crashes)                     │ TTL = 3s
       │                               │
       X (no heartbeat)                │ Removes stale entry
                                       │
                               ┌───────┴───────┐
                               │   Discovery   │
                               │   Client      │
                               └───────────────┘
```

1. **Register**: Service sends `POST /register { name, url }`.
2. **Heartbeat**: Service sends `POST /heartbeat/:id` periodically.
3. **Cleanup**: Registry removes entries where `now - lastHeartbeat > TTL`.
4. **Discover**: Client sends `GET /discover/:name` and gets healthy URLs.

## WRONG vs RIGHT

### Wrong: Registry Without Cleanup

```typescript
function getServices(name: string) {
  return registry.filter(s => s.name === name);
  // Returns dead services too!
}

// cleanup() exists but is never called
```

**Why Wrong:**
- **Stale data**: Clients get IPs of crashed containers.
- **Memory leak**: Registry grows forever.
- **Wasted requests**: Every dead entry causes a connection timeout.

### Right: TTL-Aware Registry

```typescript
const TTL = 3000;

function cleanup() {
  const now = Date.now();
  for (let i = registry.length - 1; i >= 0; i--) {
    if (now - registry[i].lastHeartbeat > TTL) {
      registry.splice(i, 1);
    }
  }
}

setInterval(cleanup, 1500);

function getServices(name: string) {
  const now = Date.now();
  return registry.filter(s =>
    s.name === name && (now - s.lastHeartbeat) <= TTL
  );
}
```

**Why Right:**
- **Fresh data**: Only recently heartbeated services are returned.
- **Bounded memory**: Old entries are pruned.
- **Fast failure**: Clients don't waste time on dead addresses.

## Key Concepts

| Concept | Definition |
|---------|------------|
| Registry | Database of currently available service instances. |
| Heartbeat | Periodic signal indicating a service is alive. |
| TTL (Time To Live) | Maximum age of a registry entry before it is considered stale. |
| Cleanup Job | Background process that removes expired entries. |
| Graceful Deregister | Explicit removal on shutdown (supplement to TTL). |

## ASCII Diagram: Cleanup in Action

```
Time: 0s
Registry: [A: alive, B: alive]

Time: 2s
A heartbeats, B heartbeats
Registry: [A: alive, B: alive]

Time: 4s
A crashes (no heartbeat)
B heartbeats
Registry: [A: stale, B: alive]

Time: 4.5s
Cleanup runs (TTL=3s)
A is removed
Registry: [B: alive]

Client discovers 'service' → only gets B
```
