# Red Team: Gateway Attacks

---

## Attack 1: Slowloris

**Payload:** Send headers slowly, one byte per second.

**Impact:** Gateway holds connection open. Resource exhaustion.

---

## Attack 2: Path Traversal

**Payload:** `GET /api/../../admin`

**Impact:** Access internal endpoints through proxy.

---

## Attack 3: Header Smuggling

**Payload:** Confuse frontend and backend with conflicting headers.

**Impact:** Bypass security controls.
