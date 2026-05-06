# v3 — Adding Validation

Now you have TypeScript. But a user just broke your API by sending:

```json
{
  "title": "",
  "company": "",
  "salary_min": -5000,
  "salary_max": 1000,
  "type": "internship"
}
```

Your database accepted it. Now you have a job with negative salary and an invalid type. Your frontend doesn't know how to render an "internship" badge because you only support `full-time` and `contract`.

## The Fix: Validation

You add `zod` to enforce rules at the edge of your API.

```ts
import { z } from 'zod';

const JobSchema = z.object({
  title: z.string().min(1).max(200),
  company: z.string().min(1),
  location: z.string().min(1),
  salary_min: z.number().int().nonnegative(),
  salary_max: z.number().int().nonnegative(),
  type: z.enum(['full-time', 'contract']),
  remote: z.boolean(),
}).refine((data) => data.salary_max >= data.salary_min, {
  message: 'salary_max must be >= salary_min',
});
```

Now:
- `""` title → rejected
- Negative salary → rejected
- `"internship"` type → rejected
- `salary_max < salary_min` → rejected

## The Money Bug is Still There

Even with validation, you store salary as `REAL` in SQLite. `99.99` becomes `99.98999999999999`.

## The Fix: Integer Cents

You change the schema to store money as integer cents.

```sql
-- Before
salary_min REAL,
salary_max REAL

-- After
salary_min INTEGER, -- in cents
salary_max INTEGER
```

Now `$99.99` is stored as `9999`. Exact. No rounding. No floating-point lies.

**Next:** Let's add logging so we can see what's happening in production.
