# M02 JSON Validator: The Incident

## 2:47 AM — The Data Corruption Cascade

You are on-call. The payment processing queue has dead-lettered 12,000 messages in the past hour. The error is uniform:

```
ValidationError: amount must be a positive number
```

But the payloads look fine:

```json
{ "amount": 99.99, "currency": "USD" }
```

You check the validator. It uses a schema:

```javascript
const schema = {
  amount: { type: 'number', minimum: 0 },
  currency: { type: 'string', enum: ['USD', 'EUR', 'GBP'] }
};
```

The `type: 'number'` check is the problem. Somewhere in the pipeline, the JSON was deserialized, then reserialized, then deserialized again. In transit, `99.99` became `"99.99"`. The validator rejects it. The message is dead-lettered. The customer is not charged. The order is not fulfilled.

## Hidden Culprit

Search the upstream service. You find this:

```javascript
// Service A
const message = { amount: 99.99, currency: 'USD' };
await queue.send(JSON.stringify(message));

// Service B
const raw = await queue.receive();
const payload = JSON.parse(raw);
// ... business logic ...
await database.insert(payload);

// Service C (the validator)
const row = await database.get(id);
// The ORM serialized amount to DECIMAL(10,2) as a string!
validate(row); // FAIL: row.amount is "99.99"
```

The database driver returns `DECIMAL` columns as strings to preserve precision. The validator assumes the data is still a number because it was a number when Service A sent it.

## The Fix (Hidden)

<details>
<summary>Click to reveal</summary>

1. **Fix the validator to be resilient**:
   ```javascript
   function validateAmount(value) {
     const num = typeof value === 'string' ? parseFloat(value) : value;
     if (typeof num !== 'number' || isNaN(num) || num < 0) {
       throw new ValidationError('amount must be a positive number');
     }
     return num;
   }
   ```

2. **Fix the data boundary**:
   Validate at the entry point to each service, not at the exit point. Service B should validate after `JSON.parse`. Service C should validate after the database read. Never assume type preservation across boundaries.

3. **Add a canonical type at serialization**:
   ```javascript
   const canonical = {
     amount: { _type: 'number', _value: '99.99' }
   };
   ```
   Or better, use a schema that defines coercion rules explicitly.

4. **Audit all DECIMAL columns**:
   Ensure the application layer casts strings to numbers immediately after database reads.

</details>

## Post-Incident Review

| Question | Answer |
|----------|--------|
| Why did the validator fail? | Type was preserved through JSON but lost through the database driver |
| Why did this affect 12,000 messages? | The queue processor validates in batch. One bad schema blocked the entire consumer group |
| What monitoring gap existed? | No metric for dead-letter queue depth. No alert for validation failure rate |
| What architectural flaw? | Validation was placed after data transformation, not before consumption |

## The Real Lesson

Validation is not a one-time gate. It is a contract that must be re-verified at every boundary where data changes representation. JSON, Protobuf, database drivers, ORMs, and HTTP clients all have different opinions about what a number is. Trust no type after a boundary crossing.
