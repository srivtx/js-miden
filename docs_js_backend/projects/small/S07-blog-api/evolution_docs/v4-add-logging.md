# v4 — Adding Logging

A user emails you: "I tried to post a comment and it didn't work."

You check your API. It's running. You try it locally. It works. You ask the user what they sent. They don't remember.

You have zero visibility into what happened. You are flying blind.

## The Fix: Structured Logging

You add `pino` because `console.log` is fine for local dev but a mess in production.

```ts
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// In every route
logger.info({ postId: id }, 'Post created');
logger.error({ err }, 'Database query failed');
```

Now when something breaks, you can trace it:

```json
{ "level": 30, "time": 1715432100000, "msg": "Post created", "postId": 42 }
{ "level": 50, "time": 1715432200000, "msg": "Database query failed", "err": { "message": "SQLITE_CONSTRAINT" } }
```

## Why Structured?

Because grepping through "Error happened lol" strings is soul-crushing. With structured logs, you can:
- Filter by `level`
- Search by `postId`
- Alert on `level >= 50`

## The New Pain

You just refactored your comment counting logic. You think it works. You deploy. A user reports that comment counts are wrong on some posts.

You broke something and didn't know until a user told you. You need tests.

**Next:** Let's write tests so we catch breakage before deploy.
