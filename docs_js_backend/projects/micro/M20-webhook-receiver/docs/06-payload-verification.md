# Payload Verification

## WHAT

**Payload verification** is the process of validating the structure, types, ranges, and semantic correctness of a webhook body *after* signature verification passes.

Signature verification (HMAC) answers: "Did this come from the provider?"
Payload verification answers: "Does this make sense?"

## WHY

A valid signature does not guarantee a valid payload:

- **Provider bugs:** A malformed release from Stripe, GitHub, or Slack could send `null` fields.
- **Schema evolution:** New fields or changed types can crash outdated consumers.
- **Replay of old events:** A signed event from 2019 for a deprecated resource type.
- **Injection via provider:** Compromised provider account sends legitimate signatures with attacker-controlled data.

## HOW

**Verification layers:**

1. **JSON Schema validation** (structure + types).
2. **Business rule validation** (e.g., `amount > 0`, `currency` in allowlist).
3. **Event type allowlist** — reject unknown `type` values.
4. **Reference integrity** — verify that referenced IDs exist in your system.

```javascript
const Ajv = require("ajv");
const ajv = new Ajv();

const stripeEventSchema = {
  type: "object",
  required: ["id", "type", "data"],
  properties: {
    id: { type: "string", pattern: "^evt_" },
    type: { type: "string", enum: ["payment_intent.succeeded", "invoice.paid"] },
    data: {
      type: "object",
      required: ["object"],
      properties: {
        object: {
          type: "object",
          required: ["id", "amount", "currency"],
          properties: {
            id: { type: "string" },
            amount: { type: "integer", minimum: 1 },
            currency: { type: "string", pattern: "^[A-Z]{3}$" }
          }
        }
      }
    }
  }
};

const validate = ajv.compile(stripeEventSchema);

function verifyPayload(event) {
  if (!validate(event)) {
    throw new Error(`Invalid payload: ${ajv.errorsText(validate.errors)}`);
  }
  // Business rules
  if (!["USD", "EUR", "GBP"].includes(event.data.object.currency)) {
    throw new Error("Unsupported currency.");
  }
}
```

## WRONG vs RIGHT

### WRONG: Signature Only

```javascript
// BAD: Trusts everything with a valid signature
app.post("/webhook", (req, res) => {
  const event = verifySignature(req);
  await processEvent(event); // What if event.data.amount is -1000?
  res.sendStatus(200);
});
```

### RIGHT: Signature + Schema + Rules

```javascript
// GOOD: Defense in depth
app.post("/webhook", (req, res) => {
  const event = verifySignature(req);
  verifyPayload(event);          // Schema + business rules
  await processEvent(event);
  res.sendStatus(200);
});
```

## Breach Story: Atlassian Jira Webhook Loop (2019)

In 2019, Atlassian experienced a service degradation when a malformed Jira webhook payload — structurally valid and correctly signed — contained an empty `issue` object. A downstream consumer did not validate the payload schema and attempted to refresh an OAuth token using `issue.id`, which was `undefined`. This triggered an infinite loop of token refreshes, exhausting rate limits and causing cascading failures across integrated services.

## References

- OWASP: Input Validation Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- JSON Schema: https://json-schema.org/
- Stripe: Event object structure — https://stripe.com/docs/api/events/object
