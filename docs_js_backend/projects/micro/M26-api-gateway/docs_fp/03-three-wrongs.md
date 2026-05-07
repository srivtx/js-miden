# Three Wrong Ways to Build Gateways

---

## Wrong #1: No Timeout

```javascript
proxy({ target: 'http://backend' });
```

**Why it's wrong:** Requests hang forever. Resource exhaustion.

---

## Wrong #2: No Error Handling

```javascript
proxyReq.on('error', () => {}); // Silently swallow!
```

**Why it's wrong:** Backend failures are invisible. Gateway returns 200 with empty body.

---

## Wrong #3: Forwarding Sensitive Headers

```javascript
// Forwarding cookie to backend
// But backend doesn't need it!
```

**Why it's wrong:** Unnecessary data transfer. Potential security leak.
