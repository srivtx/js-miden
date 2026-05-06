# v3 — Adding Validation

Now you have TypeScript *and* SQLite. Life is better. Your data survives restarts.

```ts
const stmt = db.prepare('INSERT INTO posts (title, content) VALUES (?, ?)');
const result = stmt.run(title, content);
```

## The Pain

A user sends a 5MB comment. Your database accepts it. Your API slows down. Your frontend chokes trying to render a novel in a comment thread.

Another user sends an empty `title`. Your database accepts it. Now you have a blog post with no title. Your frontend renders a blank card.

```json
POST /posts/123/comments
{ "content": "" }
```

Valid? Technically. Useful? Absolutely not.

## The Fix: Validation

You add `zod` because writing validation by hand is error-prone and boring.

```ts
import { z } from 'zod';

const PostSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(50000),
});

const CommentSchema = z.object({
  content: z.string().min(1).max(2000),
});

app.post('/posts', (req, res) => {
  const parsed = PostSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.format() });
  }
  const { title, content } = parsed.data;
  // ...
});
```

Now empty titles, missing fields, and spam-sized comments get rejected with a clean 400 error.

## What Validation Caught

- `""` title → rejected
- Missing `content` → rejected  
- 50,000 character comment → rejected
- `content: 12345` → rejected (not a string)

## The New Pain

Your API works, but when something goes wrong in production, you have no idea what happened. A user says "it broke." You say "works on my machine." You need logs.

**Next:** Let's add logging so we're not flying blind.
