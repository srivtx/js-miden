# v7 — Production Setup

Your job board works. It has filtering, sorting, type-safe code, validation, logs, and tests. But production has its own rules.

## Pain #1: SQL Injection

Your filter endpoint concatenates user input into SQL strings:

```ts
if (type) sql += ` AND type = '${type}'`;
```

A user sends `type=' OR '1'='1`. Now they see every job, including unapproved ones. This is a security disaster.

**Fix:** Parameterized queries. Always.

```ts
const conditions: string[] = [];
const values: unknown[] = [];

if (type) {
  conditions.push('type = ?');
  values.push(type);
}
if (remote) {
  conditions.push('remote = ?');
  values.push(remote === 'true' ? 1 : 0);
}

const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
const sql = `SELECT * FROM jobs ${whereClause}`;
const jobs = db.prepare(sql).all(...values);
```

## Pain #2: No Indexes

You have 10,000 jobs. Filtering by `location` takes 2 seconds because SQLite does a full table scan.

**Fix:** Add indexes.

```sql
CREATE INDEX idx_jobs_type ON jobs(type);
CREATE INDEX idx_jobs_remote ON jobs(remote);
CREATE INDEX idx_jobs_location ON jobs(location);
CREATE INDEX idx_jobs_salary ON jobs(salary_min, salary_max);
```

## Pain #3: Pagination Missing

You return all 10,000 jobs. The JSON is 5MB. Mobile users on slow connections timeout.

**Fix:** Limit and offset.

```ts
const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
const offset = parseInt(req.query.offset as string) || 0;
sql += ` LIMIT ? OFFSET ?`;
values.push(limit, offset);
```

## Pain #4: Environment Config

You hardcoded the database path and port. In production, the platform gives you env vars.

**Fix:**

```ts
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DATABASE_URL || './jobs.db';
```

## Pain #5: Process Crashes

An unhandled error kills the server. Users see 502s.

**Fix:** Graceful shutdown.

```ts
process.on('SIGTERM', () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
});
```

## Final Checklist

- [ ] Parameterized queries (no string concat)
- [ ] Database indexes on filter columns
- [ ] Pagination (limit/offset)
- [ ] Environment-based config
- [ ] Graceful shutdown
- [ ] Health check endpoint
- [ ] Request timeouts

This is a production job board. It started as a static array. Now it can handle real traffic, real filters, and real money.
