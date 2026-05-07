# Red Team: Discovery Attacks

---

## Attack 1: Registry Poisoning

**Payload:** Register a malicious service with the same name.

**Impact:** Clients connect to attacker-controlled service.

---

## Attack 2: TTL Exploitation

**Payload:** Heartbeat slowly to extend TTL.

**Impact:** Dead services stay in registry longer.

---

## Attack 3: Enumeration

**Payload:** Query registry for all services.

**Impact:** Map internal architecture. Find attack targets.
