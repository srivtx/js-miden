# M02 JSON Validator: Thinking Exercises

Answer these five questions **before** you write a single line of code.

---

## Question 1: The Falsy Required Field

A schema requires a field `count` of type `number`. A user sends:

```json
{ "count": 0 }
```

Your teammate's validator rejects it with `"count is required"`. They used `if (!value.count)`.

You fix it to `if (!(key in value))`. But now a user sends:

```json
{ "count": undefined }
```

Should this pass or fail? What does `JSON.parse` do to `undefined`? What happens if the payload comes from a JavaScript object that was built programmatically, not from JSON?

<details>
<summary>Discussion</summary>

`JSON.parse` cannot produce `undefined` as a value. It can only produce `null`, boolean, number, string, array, or object. So a JSON-only API will never see `undefined`. But if the validator is called from JavaScript code where someone did `obj.count = undefined`, then `key in value` is true.

The correct behavior depends on the contract:
- If the contract is "JSON in, JSON out", `undefined` is impossible. Using `in` is safe.
- If the contract is "JavaScript object in", `undefined` should be treated as missing.

The deeper lesson: validation rules must match the serialization boundary. A validator designed for JSON is not necessarily correct for arbitrary JavaScript objects.

</details>

---

## Question 2: The Recursive Limit

Your validator supports nested objects and arrays. A user sends a JSON payload with 10,000 nested objects:

```json
{ "a": { "a": { "a": { ... 10,000 times ... } } } }
```

What happens? Is this a bug in your validator, a bug in the user's payload, or a bug in your API design?

<details>
<summary>Discussion</summary>

A recursive validator without a depth limit will overflow the stack at around 10,000-20,000 frames in V8. This is a Denial of Service vulnerability.

It is not a bug in the user's payload — 10,000 levels of nesting is valid JSON per the spec. It is a bug in the validator. Every recursive function that processes user input must have a depth limit.

The fix: add a `maxDepth` parameter. Reject payloads deeper than a reasonable limit (e.g., 100). Most real data structures are no deeper than 10.

</details>

---

## Question 3: The Regex Cost

Your schema allows a `pattern` field. A user defines:

```json
{ "type": "string", "pattern": "^[a-z]+$" }
```

Another user defines:

```json
{ "type": "string", "pattern": "^(a+)+$" }
```

Both are valid regexes. One is safe. One is a ReDoS attack. How do you distinguish them programmatically without executing them?

<details>
<summary>Discussion</summary>

You cannot reliably distinguish safe from unsafe regexes statically in the general case. The problem is undecidable for arbitrary regexes.

Practical defenses:
1. **Whitelist patterns**: Only allow a predefined set of safe patterns.
2. **Use RE2**: Google's regex engine that guarantees linear time by removing backreferences and some other features.
3. **Timeout**: Wrap regex execution in a worker or use `vm.runInNewContext` with a timeout. This is heavy and slow.
4. **Pattern analysis**: Reject patterns with nested quantifiers (`(a+)+`, `(a*)*`) or ambiguous alternation. This catches 99% of ReDoS patterns but may reject legitimate patterns.

The safest approach for user-provided schemas: do not allow user-provided regexes.

</details>

---

## Question 4: The Type Coercion Boundary

Your API accepts JSON payloads. The schema says `age` is a `number`. A user sends:

```json
{ "age": "25" }
```

Your validator rejects it. But the user's client is an HTML form that sends `application/x-www-form-urlencoded`, and a middleware auto-converts all values to strings before JSON serialization.

Should you:
1. Reject the payload and force the client to fix their serialization?
2. Coerce `"25"` to `25` at the validation boundary?
3. Accept strings in the schema if the endpoint is known to receive form data?

<details>
<summary>Discussion</summary>

Option 1 is correct in principle but creates friction. Option 2 is pragmatic but creates a hidden transformation that other consumers might not expect. Option 3 leaks transport-layer knowledge into the schema.

The best answer: separate transport parsing from domain validation.

```javascript
// Transport layer: coerce strings to numbers based on schema hints
const coerced = coerceBySchema(rawBody, schema);

// Domain layer: validate strictly
const errors = validate(schema, coerced);
```

This way, the schema is a strict contract, but the transport layer can be lenient. The coercion rules are explicit and testable.

</details>

---

## Question 5: The Missing Field vs. The Null Field

Your schema says:

```json
{
  "type": "object",
  "properties": {
    "nickname": { "type": "string" }
  }
}
```

Three payloads arrive:

1. `{}` — `nickname` is absent.
2. `{ "nickname": null }` — `nickname` is present but null.
3. `{ "nickname": "" }` — `nickname` is present but empty.

In a SQL database, these map to:
1. Column is `NULL` (unknown).
2. Column is `NULL` (explicit null).
3. Column is `''` (known empty).

Should your validator treat #1 and #2 the same? Should the application? What if the schema is used to generate a TypeScript type where `nickname?: string` allows `undefined` but not `null`?

<details>
<summary>Discussion</summary>

JSON has `null` but not `undefined`. JSON Schema distinguishes them: `null` is a valid value if `type` includes `"null"`. Absence is only invalid if the field is `required`.

In TypeScript:
- `{ nickname?: string }` means `string | undefined`.
- `{ nickname: string | null }` means `string | null`.
- They are not the same type.

The validator should treat them differently because the JSON Schema spec does. But the application might treat them the same if the database stores both as `NULL`.

The lesson: the validator enforces the schema. The application enforces the business logic. Do not conflate them. If the business treats absent and null the same, add an explicit `default: null` or a post-validation normalization step.

</details>
