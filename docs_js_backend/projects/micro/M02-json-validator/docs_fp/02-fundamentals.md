# M02 JSON Validator: Fundamentals

## Strip the Libraries. Implement from Scratch.

You are not allowed to use `ajv`, `joi`, `zod`, `yup`, `class-validator`, or any validation library. You have:

- JavaScript (no external packages)

Build a validator that takes a schema object and a value, and returns an array of error strings.

## The Schema DSL

```javascript
const schema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    age: { type: 'number', minimum: 0, maximum: 150 },
    email: { type: 'string', format: 'email' },
    tags: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 10
    },
    address: {
      type: 'object',
      properties: {
        city: { type: 'string' },
        zip: { type: 'string', pattern: '^[0-9]{5}$' }
      },
      required: ['city']
    }
  },
  required: ['name', 'age']
};
```

## Constraints

1. Support `type`: `'string'`, `'number'`, `'boolean'`, `'array'`, `'object'`, `'null'`.
2. Support `required` for objects.
3. Support `minimum`, `maximum` for numbers.
4. Support `minLength`, `maxLength` for strings.
5. Support `pattern` for strings (regex).
6. Support `format: 'email'` with a simple regex.
7. Support `items` for arrays.
8. Support `maxItems` for arrays.
9. Support nested objects and arrays.
10. Return an array of human-readable error strings with JSON path pointers.

Example:

```javascript
validate(schema, { name: '', age: -5, email: 'bad' });
// => [
//   '"/name" must have minLength 1',
//   '"/age" must be >= 0',
//   '"/email" must match format "email"'
// ]
```

## Skeleton

```javascript
function validate(schema, value, path = '') {
  const errors = [];

  if (schema.type === 'object') {
    // ...
  }

  // ... handle other types

  return errors;
}

module.exports = { validate };
```

## Implementation Guide (Hidden)

<details>
<summary>Click to reveal</summary>

```javascript
function validate(schema, value, path = '') {
  const errors = [];

  if (schema.type !== undefined) {
    const actualType = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
    if (actualType !== schema.type) {
      errors.push(`"${path}" must be type "${schema.type}"`);
      return errors; // Stop deeper validation on type mismatch
    }
  }

  if (schema.type === 'object' && value !== null) {
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in value)) {
          errors.push(`"${path}/${key}" is required`);
        }
      }
    }
    if (schema.properties) {
      for (const [key, subSchema] of Object.entries(schema.properties)) {
        if (key in value) {
          errors.push(...validate(subSchema, value[key], `${path}/${key}`));
        }
      }
    }
  }

  if (schema.type === 'array' && Array.isArray(value)) {
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`"${path}" must have at most ${schema.maxItems} items`);
    }
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        errors.push(...validate(schema.items, value[i], `${path}[${i}]`));
      }
    }
  }

  if (schema.type === 'string' && typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`"${path}" must have minLength ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`"${path}" must have maxLength ${schema.maxLength}`);
    }
    if (schema.pattern !== undefined) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push(`"${path}" must match pattern "${schema.pattern}"`);
      }
    }
    if (schema.format === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errors.push(`"${path}" must match format "email"`);
      }
    }
  }

  if (schema.type === 'number' && typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`"${path}" must be >= ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`"${path}" must be <= ${schema.maximum}`);
    }
  }

  return errors;
}

module.exports = { validate };
```

**Key techniques:**
- **Recursive descent**: The function calls itself for nested objects and array items.
- **Early return on type mismatch**: Prevents nonsensical errors like `"/age" must have minLength 1` when the value is a boolean.
- **Path accumulation**: Pass the current path down so errors point to the exact field.

</details>

## Why This Matters

Every validation library is a recursive descent engine with a DSL. `ajv` compiles schemas to functions. `zod` builds a fluent API. But at the core, they all do what you just wrote. Understanding the engine lets you debug the abstraction. When `zod` throws a cryptic `ZodError`, you know how to trace it back to the failing check.
