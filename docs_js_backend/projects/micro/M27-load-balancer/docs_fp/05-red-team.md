# Red Team: Load Balancer Attacks

---

## Attack 1: Slow Drain

**Payload:** Server accepts connections but responds slowly.

**Impact:** Health check passes (eventually responds). But real requests timeout.

---

## Attack 2: Asymmetric Routing

**Payload:** Manipulate health checks to mark healthy servers as dead.

**Impact:** All traffic routed to attacker-controlled server.

---

## Attack 3: Resource Exhaustion

**Payload:** Send expensive requests to one server.

**Impact:** That server becomes slow. Load balancer sends more traffic (least connections). Death spiral.
