# Red Team: Config Attacks

---

## Attack 1: Environment Enumeration

**Payload:** Try different env names: `prod`, `production`, `staging`, `dev`.

**Impact:** Access all environment configs.

---

## Attack 2: Secret Extraction

**Payload:** Request config, extract database URLs, API keys.

**Impact:** Complete system compromise.

---

## Attack 3: Config Injection

**Payload:** Modify config values if write access exists.

**Impact:** Redirect traffic, disable security, steal data.
