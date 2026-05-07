# M02 JSON Validator: Red Team

## Attack Scenarios

Validation is a security boundary when it is the last line of defense. Here is how attackers bypass, abuse, or weaponize your validator.

---

## Attack 1: Schema Injection

### The Vector

Your API accepts a schema and a payload to validate against it:

```http
POST /validate
Content-Type: application/json

{
  "schema": { "type": "string", "pattern": "(a+)+" },
  "payload": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!"
}
```

### The Exploit

The schema contains a ReDoS pattern: `(a+)+`. The validator executes `new RegExp('(a+)+')` and calls `.test()` on the payload. The catastrophic backtracking freezes the event loop for 10+ seconds. The attacker sends 10 requests per second. Every instance of your API is permanently frozen.

### The Defense

1. **Never execute user-provided regexes**. If schemas are user-defined, restrict patterns to a safe subset (e.g., literal characters, quantifiers with fixed limits).
2. **Use a regex timeout library** like `re2` (Google's safe regex engine) which rejects patterns with exponential backtracking.
3. **Run validation in a worker thread** so a frozen validator does not block the event loop.

---

## Attack 2: The Prototype Pollution Bypass

### The Vector

Your validator checks required fields like this:

```javascript
for (const key of schema.required) {
  if (!(key in value)) {
    errors.push(`${key} is required`);
  }
}
```

The attacker sends:

```json
{
  "__proto__": { "isAdmin": true }
}
```

### The Exploit

The validator checks if `name` is in the payload. It is not. The validator returns an error. But the application later does:

```javascript
const config = { role: 'user' };
Object.assign(config, payload);
```

Now `config.isAdmin` is `true` because `__proto__` polluted the prototype. The validation failed, but the payload was still processed. The attacker bypassed business logic by poisoning the object that the application merged into.

### The Defense

1. **Use `Object.hasOwn(value, key)` instead of `key in value`**.
2. **Use `Object.create(null)` for all user-input objects** so they have no prototype to pollute.
3. **Never merge user input into existing objects without sanitizing keys**.
4. **Freeze the schema object** so it cannot be polluted by malicious input.

---

## Attack 3: The Type Confusion Bypass

### The Vector

Your schema says:

```javascript
{ "type": "number", "minimum": 0 }
```

The attacker sends:

```json
{
  "amount": { "toString": "99.99", "valueOf": 99.99 }
}
```

Actually, a simpler attack in JavaScript:

```javascript
const payload = { amount: new Number(99.99) };
```

Or worse:

```javascript
const payload = { amount: [] };
// typeof [] === 'object', but [] < 0 is false, [] >= 0 is true
```

Wait, a more insidious one:

```javascript
const payload = { amount: '   99.99   ' };
```

If the application does `parseFloat(payload.amount)` after validation, the string passes. But if the validator checks `typeof value === 'number'`, it fails. However, if the validator is bypassed or if there is a second code path that does not validate, the string is accepted.

The real attack is when the validator and the consumer use different type checks:

```javascript
// Validator
typeof payload.amount === 'number' // false, rejected

// Consumer (another microservice)
const total = payload.amount + 10; // '   99.99   ' + 10 = '   99.99   10'
```

### The Defense

1. **Validate and coerce at the boundary**. Do not pass raw user input deeper into the system.
2. **Use a single source of truth for types**. If the schema says `number`, convert the input to a number immediately.
3. **Reject unexpected types strictly**. Do not fall through to implicit coercion.

---

## Red Team Summary

| Attack | Impact | Defense |
|--------|--------|---------|
| ReDoS via schema | Event loop freeze, DoS | Safe regex engine, worker threads, no user regex |
| Prototype pollution | Auth bypass, privilege escalation | `Object.hasOwn`, `Object.create(null)`, key sanitization |
| Type confusion | Validation bypass, logic errors | Strict type checks, boundary coercion, single source of truth |

## The Meta-Attack

The most dangerous attacker does not break your validator. They break the assumption that validation is sufficient. Validation checks shape. It does not check intent. A payload can be perfectly valid and perfectly malicious. A schema says what data *looks like*. It never says what data *means*.
