# M09: Query Param Parser — Mental Models & Danger Zones

## Mental Model 1: The Boundary

Treat the query parser as a **security boundary**. Everything that arrives via `req.query` is untrusted. The parser's job is to validate that the input conforms to the contract before it enters the domain logic.

**WHY:** Query parameters are HTTP strings. JavaScript's dynamic typing makes it easy to pass these strings deep into the application where they cause unexpected behavior. The parser is the last line of defense before the domain layer.

## Mental Model 2: Type Coercion as an Explicit Operation

In JavaScript, type coercion is implicit and dangerous (`"1" + 1 = "11"`, but `"2" * "3" = 6`). Do not rely on JavaScript's implicit coercion. Make coercion **explicit** and **fail-fast**---if a value cannot be coerced, reject it immediately.

**WHY:** Implicit coercion creates Heisenbugs that appear only with certain input combinations. Explicit schemas make the contract visible.

## Mental Model 3: Pagination is a Resource Limiter

Pagination parameters (`limit`, `page`, `cursor`) exist to protect server resources. An attacker can omit `limit` or set `limit=999999` to extract the entire database. The parser must enforce hard upper bounds.

**WHY:** Without bounds, pagination becomes a DoS vector.

## Danger Zone 1: Type Coercion Bugs

JavaScript's coercion rules are non-intuitive:

| Operation | Result | Explanation |
|-----------|--------|-------------|
| `"1" + 1` | `"11"` | string + number -> string concatenation |
| `"2" * "3"` | `6` | string * string -> number multiplication |
| `[] + []` | `""` | array + array -> string |
| `[] + {}` | `"[object Object]"` | array + object -> string |
| `true + 1` | `2` | boolean + number -> number |
| `"5" - 3` | `2` | string - number -> number |
| `null + 1` | `1` | null -> 0 |
| `undefined + 1` | `NaN` | undefined -> NaN |

**WHY:** These rules mean that `req.query.limit` (a string) behaves differently depending on whether you use `+` (concatenation) or `*` (multiplication). This is a recipe for bugs.

## Danger Zone 2: Injection via Query Reflection

If a query parameter is reflected back in the HTML response without escaping, it becomes an XSS vector.

Example attack URL:
```
https://example.com/search?q=<script>alert('xss')</script>
```

If the server responds with:
```html
<h1>Results for: <%= req.query.q %></h1>
```

The script executes. The **parser** must sanitize or the **template** must escape. Ideally, both.

## Danger Zone 3: Negative Pagination

Users can send `?page=-1&limit=-100`. If the backend uses these directly in SQL `OFFSET`/`LIMIT`, the database may return errors or unexpected results. Always validate `min(1)` and `max(N)`.

## Danger Zone 4: False Confidence with `URLSearchParams`

`URLSearchParams` gives you strings. It does not validate types, ranges, or enum values. It is only one step above manual splitting.

**WRONG:** Trusting `URLSearchParams.get('limit')` as a number.
**RIGHT:** Treating `URLSearchParams` as raw input that still requires schema validation.

## Sources
- MDN Type Coercion: https://developer.mozilla.org/en-US/docs/Glossary/Type_coercion
- OWASP XSS: https://owasp.org/www-community/attacks/xss/
- JavaScript Equality Table: https://dorey.github.io/JavaScript-Equality-Table/
