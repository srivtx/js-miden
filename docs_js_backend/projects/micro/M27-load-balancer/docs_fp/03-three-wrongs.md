# Three Wrong Ways to Load Balance

---

## Wrong #1: No Health Checks

**Why it's wrong:** Route to dead servers. Users see errors.

---

## Wrong #2: Sticky Sessions Without Fallback

```javascript
// Always route user to same server
const server = servers[userId % servers.length];
```

**Why it's wrong:** If that server dies, the user is stuck. No failover.

---

## Wrong #3: DNS Round Robin

```javascript
// Multiple A records for same domain
```

**Why it's wrong:** DNS caches. Changes take time. No health awareness.
