# The 3AM Page: The Stale Registry

It's 3:00 AM. Requests are failing.

**Monitoring:** "Service calls returning connection refused."

You check the registry:
```javascript
const registry = {
  'payment-service': ['10.0.1.10:3000', '10.0.1.11:3000']
};
```

`10.0.1.10` was terminated 3 hours ago. But it's still in the registry.

**33% of payment requests fail.** Users can't checkout. Revenue lost.

---

## Your Turn

### Q1: Why does the registry have dead servers?

Shouldn't services unregister when they shut down?

<br><br><br><br><br>

---

## The Autopsy

### Answer: Graceful shutdown is rare

Services can die:
- **Crash:** No chance to unregister
- **Kill -9:** Instant termination
- **Network partition:** Can't reach registry to unregister
- **Bug:** Forget to unregister on shutdown

**The registry becomes a graveyard of dead services.**

### The Fix: TTL + Heartbeats

```javascript
class Registry {
  constructor() {
    this.services = new Map();
  }

  register(name, address, ttlMs = 30000) {
    const key = `${name}:${address}`;
    this.services.set(key, {
      address,
      expiresAt: Date.now() + ttlMs
    });
  }

  heartbeat(name, address) {
    this.register(name, address); // Refresh TTL
  }

  discover(name) {
    this.cleanup();
    return [...this.services.entries()]
      .filter(([key, _]) => key.startsWith(`${name}:`))
      .map(([_, value]) => value.address);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.services) {
      if (value.expiresAt < now) {
        this.services.delete(key);
      }
    }
  }
}
```

**Services must heartbeat every 30s. Dead services expire automatically.**
