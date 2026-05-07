# Impossible Constraint: No Central Registry

**Task:** Discover services without any central registry or DNS.

**Constraint:** No server, no database, no shared storage.

---

## Your Turn

How do services find each other without a directory?

**Write your approach:**

<br><br><br><br><br>

---

## The Reveal: Peer-to-Peer Discovery

**Gossip protocol:**
1. Each service knows a few peers
2. Periodically exchange lists of known services
3. Eventually, everyone knows everyone (eventual consistency)

**Multicast/Broadcast:**
1. Service starts, sends UDP broadcast: "I'm here!"
2. Other services hear it, add to local list
3. No central server needed

**The point:** Central registries are convenient but create bottlenecks. Decentralized discovery is resilient but complex.

**This constraint forces you to realize:**

> Every distributed system needs discovery. The question is whether to centralize (simple, bottleneck) or decentralize (complex, resilient).
