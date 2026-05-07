# The 3AM Page: The Dead Server

It's 3:00 AM. 50% of requests fail.

**Monitoring:** "Server #3 is down. But load balancer still sends traffic to it."

You check the load balancer:
```javascript
const servers = ['http://server1', 'http://server2', 'http://server3'];
let index = 0;

function getServer() {
  return servers[index++ % servers.length];
}
```

**No health checks.** Server 3 crashed 2 hours ago. The balancer still sends 33% of traffic to it.

**Users see 50% error rate. Not because the system is overloaded. Because 1/3 of traffic goes to a dead server.**

---

## Your Turn

### Q1: Why is round-robin without health checks dangerous?

Isn't round-robin fair?

<br><br><br><br><br>

---

## The Autopsy

### Answer: Fairness assumes all servers are equal

Round-robin works when:
- All servers are healthy
- All servers have equal capacity
- All requests are equal

**When a server is down, round-robin is 33% failure.**

### The Fix: Health Checks

```javascript
const servers = [
  { url: 'http://server1', healthy: true },
  { url: 'http://server2', healthy: true },
  { url: 'http://server3', healthy: true }
];

// Health check every 5 seconds
setInterval(async () => {
  for (const server of servers) {
    try {
      await fetch(`${server.url}/health`, { timeout: 2000 });
      server.healthy = true;
    } catch {
      server.healthy = false;
    }
  }
}, 5000);

function getServer() {
  const healthy = servers.filter(s => s.healthy);
  return healthy[index++ % healthy.length];
}
```

**Only route to healthy servers.**
