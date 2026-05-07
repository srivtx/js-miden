# Impossible Constraint: No Shared Secret

**Task:** Verify webhooks without a shared secret.

**Constraint:** You and the provider never exchanged a secret.

---

## Your Turn

How do you verify a webhook without a shared secret?

**Write your approach:**

<br><br><br><br><br>

---

## The Reveal: You Can't (With Symmetric Crypto)

Without a shared secret, symmetric HMAC is impossible.

**Alternatives:**
- **Asymmetric signatures:** Provider signs with private key, you verify with public key
- **HTTPS only:** Transport-level security, no payload verification
- **IP allowlist:** Only accept from known IPs (weak)
- **mTLS:** Mutual TLS authentication

**The point:** Symmetric HMAC requires a shared secret. If you don't have one, you need asymmetric crypto or transport security.

**Real-world:** Most webhook providers use HMAC with a secret you configure in their dashboard.
