# v7 — Production Setup

Your blog API works. It has types, validation, logs, tests, and ESM. But production is a different beast.

## Pain #1: The Database Won't Scale

SQLite is fine for a demo. But what happens when you need multiple app servers? SQLite is a file on disk. Two servers can't share it without corruption.

**Fix:** Switch to PostgreSQL.

```ts
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // connection pool size
});
```

Now you can horizontally scale your app servers. All of them talk to the same Postgres instance.

## Pain #2: The N+1 Query is Back

You thought you fixed it. But with Postgres and a real dataset:

```ts
// 1 query for posts
const posts = await pool.query('SELECT * FROM posts WHERE deleted_at IS NULL');
// N queries for comment counts
for (const post of posts.rows) {
  const count = await pool.query('SELECT COUNT(*) FROM comments WHERE post_id = $1', [post.id]);
  post.commentCount = count.rows[0].count;
}
```

With 100 posts, that's 101 queries. With 10,000 posts, your API times out.

**Fix:** A single query with a subquery or JOIN.

```ts
const sql = `
  SELECT p.*, (
    SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id
  ) as comment_count
  FROM posts p
  WHERE p.deleted_at IS NULL
  ORDER BY p.created_at DESC
  LIMIT $1 OFFSET $2
`;
```

One query. Always one query.

## Pain #3: Pagination

You return all posts. Every time. Your database has 50,000 posts. Your JSON response is 20MB. Mobile users on 3G hate you.

**Fix:** Limit and offset (or cursor-based pagination for real scale).

```ts
const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
const offset = parseInt(req.query.offset as string) || 0;
```

## Pain #4: Process Crashes

An unhandled promise rejection kills your server. A user gets a 502 Bad Gateway. You get paged at 3am.

**Fix:** Graceful shutdown and error handling.

```ts
process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, 'Unhandled rejection');
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    pool.end();
    logger.info('Server shut down gracefully');
  });
});
```

## Pain #5: No Environment Config

You hardcoded `port 3000` and a local SQLite path. In production, the platform gives you a `PORT` env var and a `DATABASE_URL`.

**Fix:** `dotenv` or native env vars. Never hardcode config.

```ts
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || 'sqlite:./blog.db';
```

## Final Checklist

- [ ] PostgreSQL instead of SQLite
- [ ] Connection pooling
- [ ] N+1 eliminated with subqueries
- [ ] Pagination (limit/offset or cursor)
- [ ] Graceful shutdown
- [ ] Environment-based config
- [ ] Health check endpoint (`GET /health`)
- [ ] Request timeout middleware

This is a production blog API. It started as a naive in-memory array. Now it can handle real traffic.
