# v5 — Adding Tests

You just shipped a "quick fix" for the N+1 query problem. Instead of one query per post, you wrote a JOIN. Or at least, you thought you did.

A day later, a user reports that comment counts are showing `null` instead of numbers. You look at your code. The alias in your SQL was wrong. You fixed one bug and introduced another.

This is the "fix and pray" cycle. It sucks.

## The Fix: Automated Tests

You add `vitest` and `supertest`. Not because testing is fun, but because manually clicking through your API after every change is insane.

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';

describe('Blog API', () => {
  it('creates a post', async () => {
    const res = await request(app)
      .post('/posts')
      .send({ title: 'Test', content: 'Body' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Test');
  });

  it('lists posts with comment counts', async () => {
    const post = await request(app)
      .post('/posts')
      .send({ title: 'Count', content: 'Me' });
    await request(app)
      .post(`/posts/${post.body.id}/comments`)
      .send({ content: 'Nice' });

    const list = await request(app).get('/posts');
    const found = list.body.find((p: any) => p.id === post.body.id);
    expect(found.commentCount).toBe(1);
  });

  it('rejects comments over 2000 chars', async () => {
    const post = await request(app)
      .post('/posts')
      .send({ title: 'Spam', content: 'Test' });
    const res = await request(app)
      .post(`/posts/${post.body.id}/comments`)
      .send({ content: 'x'.repeat(5000) });
    expect(res.status).toBe(400);
  });
});
```

## What Tests Caught

- Your SQL alias bug? Caught before deploy.
- The validation bypass someone added? Caught before deploy.
- The soft delete that wasn't filtering? Caught before deploy.

## The Confidence

Now when you refactor, you run `npm test`. Green means go. Red means stop and fix. No more praying.

**Next:** Let's modernize the module system.
