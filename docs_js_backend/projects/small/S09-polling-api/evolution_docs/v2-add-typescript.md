# v2 — Adding TypeScript

You just debugged why a poll result showed `NaN` votes.

```js
votes[req.params.id][option]++;
```

Someone sent `{ "option_id": "1" }` instead of `{ "option": "Pizza" }`. Your code looked up `votes[id][undefined]`, got `undefined`, and did `undefined++` which is `NaN`.

JavaScript didn't throw. It just silently gave you `NaN`. You didn't notice until a user screenshotted the results page showing "Pizza: NaN".

## The Fix: Types

You add TypeScript to catch these at compile time.

```ts
interface VoteBody {
  option_id: number;
}

app.post('/polls/:id/vote', (req: Request, res: Response) => {
  const { option_id } = req.body as VoteBody;
  // option_id must be a number
  // If someone sends a string, TypeScript complains
});
```

## But Wait...

TypeScript doesn't validate at runtime. A client can still send `{ "option_id": "pizza" }` and your type assertion will happily lie about it.

Also, you're still storing votes in memory. Server restarts = lost votes.

**Next:** Let's add a database and validation.
