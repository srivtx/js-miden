# Three Wrong Ways to Do Discovery

---

## Wrong #1: Hardcoded IPs

```javascript
const PAYMENT_SERVICE = 'http://10.0.1.10:3000';
```

**Why it's wrong:** IP changes on redeploy. Service moves. Network reconfigures.

---

## Wrong #2: No Health Checks

```javascript
// Registry has 5 services. 2 are dead.
// No way to know which.
```

**Why it's wrong:** Clients connect to dead services. Failures.

---

## Wrong #3: Synchronous Registry Lookup

```javascript
const services = await registry.lookup('payment');
const service = services[0];
```

**Why it's wrong:** Registry becomes a bottleneck. Single point of failure.

**Fix:** Cache registry results. Refresh in background.
