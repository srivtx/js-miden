# Red Team: SSRF Exploitation

---

## Attack 1: Metadata Service

**Payload:** `?host=169.254.169.254`

**Impact:** Access cloud metadata. Steal IAM credentials.

---

## Attack 2: Internal Scanning

**Payload:** `?host=10.0.0.${i}` for i=1..255

**Impact:** Map internal network. Find vulnerable services.

---

## Attack 3: localhost Access

**Payload:** `?host=localhost:6379` (Redis)

**Impact:** Access internal services without authentication.
