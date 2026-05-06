# v2 — Adding TypeScript

You just spent two hours debugging why a salary filter was returning incorrect results.

```js
// Someone sent this:
{ "salary_min": "50000", "salary_max": "100000" }
```

Strings. Your comparison `salary_max >= salary_min` was doing string comparison. `"100000" < "50000"` because `"1" < "5"` lexicographically. The filter returned nothing.

You add `console.log` everywhere. You find it eventually. You hate yourself.

## The Fix: Types

You add TypeScript so the compiler catches these before runtime.

```ts
interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  salary_min: number;
  salary_max: number;
  type: 'full-time' | 'contract';
  remote: boolean;
}

app.post('/jobs', (req: Request, res: Response) => {
  const body = req.body as Job;
  // salary_min is typed as number
  // If someone sends a string, TypeScript screams at compile time
});
```

## But Wait...

TypeScript doesn't validate at runtime. A client can still send strings. And your money is still stored as `REAL` in SQLite, which means `99.99` is still a float internally.

Types catch *your* bugs. They don't catch *user* bugs or *database* bugs.

**Next:** Let's add validation and fix the money problem.
