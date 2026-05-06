# v2 — Adding TypeScript

You just spent an hour debugging why a post's `content` field was rendering as `[object Object]`.

Turns out someone sent:
```json
{ "title": "Hi", "content": { "html": "<p>hi</p>" } }
```

Your JavaScript happily spread that object into your in-memory array. The frontend tried to render it as a string. Chaos.

## The Fix: Types

You add TypeScript. Not because it's trendy, but because you're tired of playing whack-a-mole with runtime type errors.

```ts
interface Post {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

app.post('/posts', (req: Request, res: Response) => {
  const { title, content } = req.body as { title: string; content: string };
  // ...
});
```

Now `content: { html: "..." }` fails at compile time. Or at least your IDE screams at you.

## But Wait...

TypeScript doesn't validate at runtime. A malicious client can still send anything. Types catch *your* bugs, not *user* bugs.

```ts
// This compiles fine. The type assertion is a lie.
const body = req.body as Post;
// body could literally be anything.
```

Also, your `posts` array is still in memory. Restart the server, lose the data. You need a real database.

**Next:** Let's add SQLite and see what breaks.
