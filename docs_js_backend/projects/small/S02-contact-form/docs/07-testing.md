# S02 Contact Form — Testing

## Test Strategy

| Layer | Tool | Coverage |
|-------|------|----------|
| Unit | Jest | Middleware logic in isolation |
| Integration | Supertest | Full request/response cycle |
| E2E | Playwright | Real browser form submission |

## Running Tests

```bash
npm test
```

## Key Test Cases

### 1. Valid Submission
```ts
await request(app)
  .post('/contact')
  .send({ name: 'Ada', email: 'ada@example.com', message: 'Hello' })
  .expect(200);
```

### 2. Honeypot Trigger
```ts
await request(app)
  .post('/contact')
  .send({ name: 'Bot', email: 'bot@example.com', message: 'Buy pills', website: 'evil.com' })
  .expect(200) // silent success
  .then(res => expect(res.body.success).toBe(true));
```

**Why 200?** Returning an error tells the bot author which field to fix. A silent success wastes their time.

### 3. Rate Limiting (if applied)
```ts
for (let i = 0; i < 4; i++) {
  const res = await request(app).post('/contact').send(validBody);
  if (i < 3) expect(res.status).toBe(200);
  else expect(res.status).toBe(429);
}
```

### 4. Validation Edge Cases

| Input | Expected |
|-------|----------|
| `name = ""` | 400 |
| `email = "not-an-email"` | 400 |
| `message = "a".repeat(5001)` | 400 |
| `email = "Test@Example.COM"` | 200 (normalized to lowercase) |

### 5. Redis Down (Fail-Open)
Mock `redis.incr` to throw:
```ts
jest.spyOn(redis, 'incr').mockRejectedValue(new Error('ECONNREFUSED'));
await request(app).post('/contact').send(validBody).expect(200);
```

## Load Testing

Use `autocannon` to verify behavior under spam:

```bash
npx autocannon -m POST -H "Content-Type=application/json" \
  -b '{"name":"x","email":"a@b.com","message":"m"}' \
  -c 10 -d 5 http://localhost:3000/contact
```

Without rate limiting (current bug), expect ~15,000 successful requests in 5 seconds.
With rate limiting applied, expect 30 successes and ~14,970 `429` responses.

## Why Test the Honeypot

The honeypot is "invisible" code. It is easy to accidentally remove the `website` field check during a refactor. A regression test guarantees bot protection survives code changes.
