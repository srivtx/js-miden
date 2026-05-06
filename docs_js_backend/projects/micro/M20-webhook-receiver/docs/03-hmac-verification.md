# HMAC Signature Verification

## WHAT

**HMAC** (Hash-based Message Authentication Code) combines a cryptographic hash function (e.g., SHA-256) with a secret key to produce a signature. The webhook provider and consumer share a secret; the provider signs the payload, and the consumer verifies it.

Common signature formats:

- Stripe: `t=<timestamp>,v1=<hex_hmac>`
- GitHub: `sha256=<hex_hmac>`
- Generic: `X-Signature: <base64_hmac>`

## WHY

Without signature verification, an attacker who discovers your webhook URL can forge events:

- Fake payment confirmations.
- Spoofed repository push events.
- Fraudulent order cancellations.

HMAC ensures **integrity** (payload was not modified) and **authenticity** (payload came from the secret holder).

## HOW

**Correct verification flow:**

1. Extract the raw request body **before JSON parsing**.
2. Reconstruct the signed string (usually `timestamp + "." + payload`).
3. Compute HMAC-SHA256 with the shared secret.
4. Compare using **constant-time equality** to prevent timing attacks.

```javascript
const crypto = require("crypto");

function verifyStripeWebhook(body, sigHeader, secret) {
  const [t, v1] = sigHeader.split(",").map(s => s.trim());
  const timestamp = t.split("=")[1];
  const signature = v1.split("=")[1];

  const signedPayload = `${timestamp}.${body}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  // Constant-time comparison
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
```

## WRONG vs RIGHT

### WRONG: Parse JSON Before Verifying

```javascript
// BAD: express.json() modifies whitespace/ordering; HMAC will fail
app.use(express.json());
app.post("/webhook", (req, res) => {
  const sig = req.headers["x-signature"];
  const body = JSON.stringify(req.body); // NOT the original bytes!
  if (sig !== computeHmac(body)) { ... } // String comparison is also timing-unsafe
});
```

### RIGHT: Raw Body + Constant-Time Compare

```javascript
// GOOD: express.raw preserves exact bytes
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["x-signature"];
  const isValid = verifyHmac(req.body, sig, SECRET); // req.body is a Buffer
  if (!isValid) return res.sendStatus(401);
  const payload = JSON.parse(req.body);
  // ... process payload
});
```

## Breach Story: GitHub Partner Integration (2018)

In 2018, GitHub discovered that a third-party CI partner did not verify webhook signatures on repository events. An attacker who guessed or discovered the webhook endpoint could send crafted `push` events, triggering unauthorized builds and exfiltrating environment variables from the CI pipeline. GitHub's post-mortem emphasized mandatory HMAC verification and secret rotation.

## References

- FIPS PUB 198-1: The Keyed-Hash Message Authentication Code (HMAC)
- RFC 2104 — HMAC: Keyed-Hashing for Message Authentication
- OWASP: Testing for Weak Lock Out Mechanism
- GitHub Docs: Securing your webhooks — https://docs.github.com/en/webhooks/using-webhooks/securing-your-webhooks
