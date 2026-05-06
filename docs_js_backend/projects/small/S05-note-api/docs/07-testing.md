# S05 Note API — Testing

## Test Strategy

| Layer | Tool | Coverage |
|-------|------|----------|
| Unit | Vitest | Utility functions, validation logic |
| Integration | Supertest + test database | All endpoints |
| Database | `pgtest` or Docker | Schema migrations, indexes |
| Security | Manual + `sqlmap` | Injection vectors |

## Database Setup for Tests

Use a separate test database to avoid polluting development data:

```ts
// testSetup.ts
import { Pool } from 'pg';
export const testPool = new Pool({ database: 'notes_test' });
beforeAll(async () => {
  await testPool.query('TRUNCATE notes RESTART IDENTITY CASCADE');
});
afterAll(async () => {
  await testPool.end();
});
```

## Key Test Cases

### 1. CRUD Happy Path
```ts
const create = await request(app).post('/notes').send({ title: 'Hello', content: 'World' });
expect(create.status).toBe(201);
const id = create.body.id;

const get = await request(app).get(`/notes/${id}`);
expect(get.body.title).toBe('Hello');

const update = await request(app).put(`/notes/${id}`).send({ title: 'Hi', content: 'Earth' });
expect(update.body.title).toBe('Hi');

await request(app).delete(`/notes/${id}`).expect(204);
await request(app).get(`/notes/${id}`).expect(404);
```

### 2. Soft Delete Integrity
```ts
await request(app).delete(`/notes/${id}`).expect(204);
const list = await request(app).get('/notes');
expect(list.body.data.some(n => n.id === id)).toBe(false);
```

### 3. SQL Injection (Bug Demonstration)
```ts
const res = await request(app).get("/notes?q='; DROP TABLE notes; --");
// Current code: executes unsafely
// Fixed code: returns results for literal string or 400
```

After fixing, the search should treat the input as a literal string pattern.

### 4. Pagination Edge Cases
```ts
// Empty page beyond dataset
const res = await request(app).get('/notes?page=999');
expect(res.body.data).toEqual([]);

// Limit bounds
const over = await request(app).get('/notes?limit=9999');
expect(over.body.data.length).toBeLessThanOrEqual(100);
```

### 5. Search Performance Regression
Seed 10,000 rows and assert search responds in <100 ms. If it takes >500 ms, the missing index is caught before production.

## Load Testing

```bash
npx autocannon -m POST -H "Content-Type=application/json" \
  -b '{"title":"t","content":"c"}' \
  -c 50 -d 10 http://localhost:3000/notes
```

Monitor PostgreSQL `pg_stat_activity` for connection pool saturation.

## Why Test the Search Endpoint

Search is the most complex query (dynamic SQL, sorting, pagination). It is also the most likely to regress during refactoring. A dedicated test prevents the ILIKE injection from being reintroduced.
