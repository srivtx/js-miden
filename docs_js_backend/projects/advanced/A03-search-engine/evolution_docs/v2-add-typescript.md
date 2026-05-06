# v2 — Adding TypeScript

You just debugged why searching for "coffee" returned zero results.

```js
app.get('/products', (req, res) => {
  const query = req.query.q;
  const results = products.filter((p) => p.name.includes(query));
  res.json(results);
});
```

The user sent `?q=Coffee` (capital C). `includes` is case-sensitive. You meant to lowercase both sides. TypeScript wouldn't have caught the case-sensitivity bug, but it would have caught this:

```js
const results = products.filter((p) => p.nane.includes(query));
```

`p.nane` is `undefined`. No error in JavaScript. Just empty results.

## The Fix: Types

```ts
interface Product {
  id: number;
  name: string;
  category: string;
  description: string;
  price: number;
}

app.get('/products', (req, res) => {
  const query = (req.query.q as string)?.toLowerCase() ?? '';
  const results: Product[] = products.filter((p) =>
    p.name.toLowerCase().includes(query)
  );
  res.json(results);
});
```

Now `p.name` is guaranteed to exist. Autocomplete works. No typos.

## But Wait...

TypeScript doesn't make search faster. It doesn't add relevance scoring. It just prevents `p.nane` bugs.

**Next:** Let's add validation so malicious queries don't crash the server.
