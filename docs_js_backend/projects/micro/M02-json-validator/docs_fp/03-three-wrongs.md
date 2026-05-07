# M02 JSON Validator: Three Wrongs

Below are three plausible but broken JSON validators. Each looks reasonable. Each will fail in production.

---

## Wrong #1: The Optimistic Type Checker

```javascript
function validate(schema, value) {
  if (schema.type === 'object') {
    for (const key of schema.required || []) {
      if (!value[key]) {
        throw new Error(`Missing required field: ${key}`);
      }
    }
  }
}
```

### Why It Looks Right
It checks required fields. It throws on missing data. It is concise.

### Why It Destroys You
`!value[key]` is not the same as `!(key in value)`. If a field is present but falsy — `0`, `false`, `''`, `null` — it is rejected as "missing." A user with age `0` is told their age is required. A boolean field set to `false` is rejected. A tag set to `''` is rejected.

**The failure mode**: Intermittent validation failures for perfectly valid data. Customer support tickets flood in. You add a workaround in the frontend that sends `age: 1` instead of `age: 0`. The bug persists for years.

---

## Wrong #2: The Deep Recursion without Cycle Detection

```javascript
function validate(schema, value) {
  if (schema.type === 'object') {
    for (const [key, sub] of Object.entries(schema.properties)) {
      validate(sub, value[key]);
    }
  }
  if (schema.type === 'array') {
    for (const item of value) {
      validate(schema.items, item);
    }
  }
}
```

### Why It Looks Right
It recursively validates nested structures. It handles objects and arrays.

### Why It Destroys You
There is no cycle detection. If a user sends a self-referencing object:

```javascript
const obj = { name: 'test' };
obj.self = obj;
```

The validator recurses infinitely until the stack overflows. In Node.js, this crashes the process. An attacker can send a 5 KB payload that crashes every instance of your API.

**The failure mode**: A single malicious request crashes the server. You have a Denial of Service vulnerability that requires no authentication.

---

## Wrong #3: The Regex without Anchors

```javascript
if (schema.pattern) {
  const regex = new RegExp(schema.pattern);
  if (!regex.test(value)) {
    throw new Error('Pattern mismatch');
  }
}
```

### Why It Looks Right
It uses a regex to validate strings. It throws on mismatch.

### Why It Destroys You
The regex is not anchored. A pattern like `[0-9]{5}` matches any string that *contains* 5 digits anywhere. `"abc12345xyz"` passes as a ZIP code. `"evil12345"` passes as a numeric ID. Worse, `RegExp` without anchoring is vulnerable to ReDoS if the pattern is user-controlled. A pattern like `(a+)+$` is safe with anchoring, but without it, a substring like `(a+)+` inside a larger regex can still be exploited.

Actually, the bigger issue: the pattern in the schema is user-provided, and you construct `new RegExp(schema.pattern)` directly. A pattern like `(a+)+` with a 30-character string causes catastrophic backtracking. The event loop is blocked for seconds. The server is DoSed by a validation rule.

**The failure mode**: Invalid data passes validation, leading to database corruption. Or, a malicious pattern freezes the server.

---

## The Pattern

| Wrong | Surface Appeal | Hidden Failure |
|-------|---------------|----------------|
| Optimistic type checker | Simple required check | Falsy values rejected |
| Deep recursion without cycle guard | Recursive, handles nesting | Stack overflow on cyclic input |
| Regex without anchoring | Flexible pattern matching | Partial matches, ReDoS vulnerability |

The correct validator uses `in` for presence, a `visited` Set for cycle detection, and anchored regexes with ReDoS-safe pattern restrictions.
