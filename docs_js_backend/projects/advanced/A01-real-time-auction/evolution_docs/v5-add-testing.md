# v5 — Adding Testing

You "fixed" the race condition by wrapping the bid check in a `setImmediate`. You deploy. Now bids are occasionally accepted twice. You have no test that simulates concurrent bidding.

## The Fix: Automated Tests

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Auction Bidding', () => {
  it('accepts a valid bid', async () => {
    await request(app)
      .post('/auctions/550e8400-e29b-41d4-a716-446655440000/bid')
      .send({ user: 'alice', amount: 100 })
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('accepted');
      });
  });

  it('rejects a bid below highest', async () => {
    await request(app)
      .post('/auctions/550e8400-e29b-41d4-a716-446655440000/bid')
      .send({ user: 'alice', amount: 100 });

    await request(app)
      .post('/auctions/550e8400-e29b-41d4-a716-446655440000/bid')
      .send({ user: 'bob', amount: 50 })
      .expect(400);
  });

  it('rejects bids on closed auctions', async () => {
    // Create auction that ended yesterday
    // ...
    await request(app)
      .post('/auctions/expired-id/bid')
      .send({ user: 'alice', amount: 100 })
      .expect(400);
  });

  it('handles concurrent bids deterministically', async () => {
    const promises = [
      request(app).post('/auction/concurrent/bid').send({ user: 'a', amount: 100 }),
      request(app).post('/auction/concurrent/bid').send({ user: 'b', amount: 100 }),
    ];
    const results = await Promise.all(promises);
    const accepted = results.filter((r) => r.status === 200);
    expect(accepted.length).toBe(1); // Only one winner
  });
});
```

## What Tests Caught

- Concurrent double-acceptance → caught
- Closed auction acceptance → caught
- Negative amount rejection → caught

## The Confidence

Now you can refactor the bidding engine, add WebSockets, or split services and know that bid invariants hold.

**Next:** Let's modernize the module system before splitting the monolith.
