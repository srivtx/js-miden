# M02 JSON Validator: Impossible Constraints

## The Challenge

Implement JSON validation **without** using:

- `typeof`
- `instanceof`
- `Array.isArray`
- `Object.prototype.toString.call`

You may only use:

- Strict equality (`===`, `!==`)
- Comparison operators (`<`, `>`, `<=`, `>=`)
- Arithmetic operators (`+`, `-`, `*`, `/`, `%`)
- String methods (`length`, `charAt`, `charCodeAt`, `indexOf`)
- Object property access (`obj.prop`, `obj['prop']`)
- The literals `null`, `true`, `false`
- `JSON.stringify`

## Why This Is Hard

Every type check in JavaScript is a built-in operator. Without them, you must deduce types from behavior. For example:

- `null` is the only value where `x === null` is true.
- `true` and `false` are the only values where `x === true` or `x === false`.
- Numbers satisfy `x + 0 === x` and `x !== null` and `x !== true` and `x !== false` and `x !== undefined`.
- But `NaN` fails `NaN + 0 === NaN`.
- Strings satisfy `x + '' === x`.
- Arrays satisfy `x.length !== undefined` and `x[0] === x[0]`.
- But objects also have `length` sometimes.

## The Constraint Set

| Type | Constraint |
|------|------------|
| `null` | `x === null` |
| `boolean` | `x === true \|\| x === false` |
| `number` | Must distinguish from string, array, object |
| `string` | Must distinguish from array, object |
| `array` | Must distinguish from object with `length` |
| `object` | Everything else that is not the above |

## Hints (Hidden)

<details>
<summary>Click to reveal</summary>

Use `JSON.stringify` as a primitive type probe:

- `JSON.stringify(null)` → `"null"`
- `JSON.stringify(true)` → `"true"`
- `JSON.stringify(42)` → `"42"`
- `JSON.stringify('hello')` → `'"hello"'`
- `JSON.stringify([1,2])` → `'"[1,2]"'` wait no, it's `'[1,2]'` — no quotes around the whole thing.
- `JSON.stringify({a:1})` → `'{"a":1}'`

So:

```javascript
function getType(x) {
  if (x === null) return 'null';
  if (x === true || x === false) return 'boolean';

  const s = JSON.stringify(x);
  if (s[0] === '"') return 'string';
  if (s[0] === '[') return 'array';
  if (s[0] === '{') return 'object';

  // At this point, x is a number or undefined or function or symbol
  // For a validator, undefined is not a valid JSON type
  // Check if it's a number:
  if (s !== undefined && s !== '' && !isNaN(x - x)) {
    // x - x is 0 for all numbers except NaN (which is NaN)
    // Wait, we can't use isNaN. Use x !== x for NaN detection.
  }
}
```

Actually, `x !== x` is `true` only for `NaN`. So:

```javascript
if (x !== x) return 'NaN'; // not a valid type in our schema
if (s !== undefined && s[0] !== 'u') return 'number';
```

But `JSON.stringify(undefined)` is `undefined`. And `JSON.stringify(function(){})` is `undefined`. So anything that stringifies to `undefined` is invalid.

The full solution:

```javascript
function getType(x) {
  if (x === null) return 'null';
  if (x === true || x === false) return 'boolean';

  const s = JSON.stringify(x);
  if (s === undefined) return 'invalid';
  if (s[0] === '"') return 'string';
  if (s[0] === '[') return 'array';
  if (s[0] === '{') return 'object';
  if (x !== x) return 'NaN';
  return 'number';
}
```

This works because:
- `JSON.stringify` on a string wraps it in quotes.
- On an array, it starts with `[`.
- On an object, it starts with `{`.
- On a number, it starts with a digit or `-`.

</details>

## Skeleton

```javascript
function getType(x) {
  // Implement without typeof, instanceof, Array.isArray, toString
}

function validate(schema, value, path = '') {
  const errors = [];

  if (schema.type) {
    const actual = getType(value);
    if (actual !== schema.type) {
      errors.push(`"${path}" expected ${schema.type}, got ${actual}`);
      return errors;
    }
  }

  // ... rest of validation using only allowed operators
}
```

## Why This Is Worth Doing

You are rebuilding the JavaScript type system from first principles. This teaches you:

- Why `typeof [] === 'object'` is a language design wart.
- Why `null` is not an object, despite `typeof null === 'object'`.
- Why `JSON.stringify` is a serialization function that happens to expose type structure.

The exercise is absurd in production, but the mental model you build is permanent.
