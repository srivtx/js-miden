# MD18 LMS — v5 Add Testing

## Goal
Protect the enrollment race condition with automated tests.

## Changes from v4
- Add `vitest` + `supertest`
- Add `tests/app.test.ts`
- Seed in-memory SQLite per test

## Test Structure
```
tests/
  app.test.ts
  setup.ts
  utils.ts
```

## Key Tests

### `tests/app.test.ts`
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db.js';

describe('Enrollments', () => {
  beforeEach(async () => {
    await db.run('DELETE FROM enrollments');
    await db.run('DELETE FROM courses');
  });

  it('should enroll a user', async () => {
    const res = await request(app).post('/api/enrollments').send({
      userId: 'user-1',
      courseId: 'course-1',
    });
    expect(res.status).toBe(201);
  });

  it('BUG: enrollment race condition on last slot', async () => {
    // Set course maxStudents to 1
    await db.run('INSERT INTO courses (id, title, instructor_id, max_students) VALUES (?, ?, ?, ?)',
      ['course-1', 'Test', 'inst-1', 1]);

    const p1 = request(app).post('/api/enrollments').send({ userId: 'user-a', courseId: 'course-1' });
    const p2 = request(app).post('/api/enrollments').send({ userId: 'user-b', courseId: 'course-1' });

    const [res1, res2] = await Promise.all([p1, p2]);
    if (res1.status === 201 && res2.status === 201) {
      console.log('BUG CONFIRMED: Both users enrolled in last slot');
    }
  });
});
```

## Benefits
- `npm test` catches regressions
- Tests document the known race condition
- Supertest validates HTTP layer

## Still Missing
- Still CommonJS
- No containerization
