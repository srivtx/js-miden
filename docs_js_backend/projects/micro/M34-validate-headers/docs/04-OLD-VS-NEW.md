# M34: Old Patterns vs New Patterns

## 2015: Manual `req.headers` inspection
```js
if (req.headers['Content-Type'] !== 'application/json') {
  res.status(400).send('bad header');
}
```
- **Problems**: Case-sensitive, doesn't handle arrays, no schema validation

## 2025: Schema validation with Zod
```ts
import { z } from 'zod';

const HeaderSchema = z.object({
  'content-type': z.string().regex(/application\/json/),
  'authorization': z.string().startsWith('Bearer '),
});

const headers = HeaderSchema.parse(req.headers);
```
- **Benefits**: Type-safe, automatic coercion, clear error messages
- **Note**: Zod keys are case-sensitive by default; use `.transform()` or `req.get()` wrapper
