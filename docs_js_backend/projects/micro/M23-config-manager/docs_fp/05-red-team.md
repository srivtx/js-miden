# Red Team: Config Attacks

---

## Attack 1: Env Injection

**Payload:** Set `NODE_ENV=production` on a dev server.

**Impact:** Production optimizations enabled, debug info hidden, caching aggressive.

---

## Attack 2: Config File Leak

**Payload:** `https://yoursite.com/.env` or `https://yoursite.com/config.json`

**Impact:** Database credentials, API keys, secrets exposed.

---

## Attack 3: Log Injection

**Payload:** Set `LOG_LEVEL=debug` on production.

**Impact:** Sensitive data logged (passwords, tokens). Logs exposed.
